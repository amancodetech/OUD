import { Decimal, zero, toDecimal, isQtyZero, isMoneyZero, QTY_EPSILON, MONEY_EPSILON } from './decimal';
import { getMonthIndex } from './period';
import {
  ItemDomain,
  PurchaseLineDomain,
  SaleLineDomain,
  ReturnLineDomain,
  StockIssueDomain,
  ProductionBatchDomain,
  ItemMonthCostingState,
  CostingResult,
} from './types';

export interface CostingEngineInput {
  startYear: number;
  items: ItemDomain[];
  purchases: PurchaseLineDomain[];
  sales: SaleLineDomain[];
  returns: ReturnLineDomain[];
  stockIssues: StockIssueDomain[];
  batches: ProductionBatchDomain[];
  targetMaxMonthIndex?: number;
}

/**
 * Monthly Weighted Average Costing Engine (Strict specs/11-costing-engine.md implementation)
 * Pure TypeScript, zero external dependencies other than decimal.js and period helpers.
 */
export function computeCostingEngine(input: CostingEngineInput): CostingResult {
  const { startYear, items, purchases, sales, returns, stockIssues, batches } = input;

  // Filter only POSTED records
  const postedPurchases = purchases.filter((p) => p.status === 'POSTED');
  const postedSales = sales.filter((s) => s.status === 'POSTED');
  const postedReturns = returns.filter((r) => r.status === 'POSTED');
  const postedStockIssues = stockIssues.filter((i) => i.status === 'POSTED');
  const postedBatches = batches.filter((b) => b.status === 'POSTED');

  // Lookup maps for fast resolution of source lines
  const purchaseLineMap = new Map<string, PurchaseLineDomain>();
  for (const p of postedPurchases) {
    purchaseLineMap.set(p.id, p);
  }

  const saleLineMap = new Map<string, SaleLineDomain>();
  for (const s of postedSales) {
    saleLineMap.set(s.id, s);
  }

  // Pre-calculate monthIndex for all documents
  const purchaseLineMonth = new Map<string, number>();
  for (const p of postedPurchases) {
    purchaseLineMonth.set(p.id, getMonthIndex(p.invoiceDate, startYear));
  }

  const saleLineMonth = new Map<string, number>();
  for (const s of postedSales) {
    saleLineMonth.set(s.id, getMonthIndex(s.invoiceDate, startYear));
  }

  const returnLineReturnMonth = new Map<string, number>();
  const returnLineSourceMonth = new Map<string, number>();
  const returnLineItemId = new Map<string, string>();
  const returnLineOriginalNetUnitPrice = new Map<string, Decimal>();

  for (const r of postedReturns) {
    const retMonth = getMonthIndex(r.returnDate, startYear);
    returnLineReturnMonth.set(r.id, retMonth);

    if (r.type === 'SALE_RETURN' && r.sourceSaleLineId) {
      const src = saleLineMap.get(r.sourceSaleLineId);
      if (src) {
        const srcMonth = purchaseLineMonth.get(src.id) ?? getMonthIndex(src.invoiceDate, startYear);
        returnLineSourceMonth.set(r.id, srcMonth);
        returnLineItemId.set(r.id, src.itemId);
        const unitPrice = src.qty.isZero() ? zero() : src.netSaleAmount.div(src.qty);
        returnLineOriginalNetUnitPrice.set(r.id, unitPrice);
      }
    } else if (r.type === 'PURCHASE_RETURN' && r.sourcePurchaseLineId) {
      const src = purchaseLineMap.get(r.sourcePurchaseLineId);
      if (src) {
        const srcMonth = purchaseLineMonth.get(src.id) ?? getMonthIndex(src.invoiceDate, startYear);
        returnLineSourceMonth.set(r.id, srcMonth);
        returnLineItemId.set(r.id, src.itemId);
        const unitCost = src.qty.isZero() ? zero() : src.lineTotalCost.div(src.qty);
        returnLineOriginalNetUnitPrice.set(r.id, unitCost);
      }
    }
  }

  const stockIssueMonth = new Map<string, number>();
  for (const i of postedStockIssues) {
    stockIssueMonth.set(i.id, getMonthIndex(i.issueDate, startYear));
  }

  const batchMonth = new Map<string, number>();
  for (const b of postedBatches) {
    batchMonth.set(b.id, getMonthIndex(b.completionDate, startYear));
  }

  // Determine maximum month index to compute
  let maxMonth = input.targetMaxMonthIndex ?? 12;
  for (const m of purchaseLineMonth.values()) maxMonth = Math.max(maxMonth, m);
  for (const m of saleLineMonth.values()) maxMonth = Math.max(maxMonth, m);
  for (const m of returnLineReturnMonth.values()) maxMonth = Math.max(maxMonth, m);
  for (const m of stockIssueMonth.values()) maxMonth = Math.max(maxMonth, m);
  for (const m of batchMonth.values()) maxMonth = Math.max(maxMonth, m);

  // Data structure to hold results: itemId -> array indexed by (m - 1)
  const itemStates = new Map<string, ItemMonthCostingState[]>();
  for (const it of items) {
    itemStates.set(it.id, []);
  }

  // Helper maps for quick item lookup
  const itemMap = new Map<string, ItemDomain>();
  for (const it of items) {
    itemMap.set(it.id, it);
  }

  // Iterate month by month: m = 1 .. maxMonth
  for (let m = 1; m <= maxMonth; m++) {
    // -------------------------------------------------------------
    // Step 2.1: Calculate monthly flows for all items in month m
    // -------------------------------------------------------------
    const flowsByItem = new Map<
      string,
      {
        PQ: Decimal;
        PV: Decimal;
        PRS_Q: Decimal;
        PRS_V: Decimal;
        PRP_Q: Decimal;
        SQ: Decimal;
        CQ: Decimal;
        ISSUE_Q: Decimal;
        SR_SAME_Q: Decimal;
        SR_PRIOR_Q: Decimal;
        RAW_SR_PRIOR_V: Decimal;
        SR_PRIOR_V: Decimal;
      }
    >();

    for (const it of items) {
      flowsByItem.set(it.id, {
        PQ: zero(),
        PV: zero(),
        PRS_Q: zero(),
        PRS_V: zero(),
        PRP_Q: zero(),
        SQ: zero(),
        CQ: zero(),
        ISSUE_Q: zero(),
        SR_SAME_Q: zero(),
        SR_PRIOR_Q: zero(),
        RAW_SR_PRIOR_V: zero(),
        SR_PRIOR_V: zero(),
      });
    }

    // 1 & 2: Purchases in month m
    for (const p of postedPurchases) {
      if (purchaseLineMonth.get(p.id) === m) {
        const flow = flowsByItem.get(p.itemId);
        if (flow) {
          flow.PQ = flow.PQ.plus(p.qty);
          flow.PV = flow.PV.plus(p.lineTotalCost);
        }
      }
    }

    // 3, 4, 5, 9, 10, 11, 12: Returns in month m
    for (const r of postedReturns) {
      const retM = returnLineReturnMonth.get(r.id);
      if (retM === m) {
        const itemId = returnLineItemId.get(r.id);
        const srcM = returnLineSourceMonth.get(r.id);
        const flow = itemId ? flowsByItem.get(itemId) : undefined;
        const origUnitVal = returnLineOriginalNetUnitPrice.get(r.id) ?? zero();

        if (flow && srcM !== undefined && itemId) {
          if (r.type === 'PURCHASE_RETURN') {
            if (srcM === m) {
              // Same-month purchase return
              flow.PRS_Q = flow.PRS_Q.plus(r.qty);
              flow.PRS_V = flow.PRS_V.plus(r.qty.mul(origUnitVal));
            } else if (srcM < m) {
              // Prior-month purchase return
              flow.PRP_Q = flow.PRP_Q.plus(r.qty);
            }
          } else if (r.type === 'SALE_RETURN' && r.saleReturnCondition === 'GOOD') {
            if (srcM === m) {
              // Same-month good sales return
              flow.SR_SAME_Q = flow.SR_SAME_Q.plus(r.qty);
            } else if (srcM < m) {
              // Prior-month good sales return
              flow.SR_PRIOR_Q = flow.SR_PRIOR_Q.plus(r.qty);

              // Prior values use past RAVG and AVG from month srcM
              const pastStates = itemStates.get(itemId);
              const pastState = pastStates ? pastStates[srcM - 1] : undefined;
              const pastRAVG = pastState ? pastState.RAVG : zero();
              const pastAVG = pastState ? pastState.AVG : zero();

              flow.RAW_SR_PRIOR_V = flow.RAW_SR_PRIOR_V.plus(r.qty.mul(pastRAVG));
              flow.SR_PRIOR_V = flow.SR_PRIOR_V.plus(r.qty.mul(pastAVG));
            }
          }
        }
      }
    }

    // 6: Sales in month m (including SALE and DRIVER_GIFT)
    for (const s of postedSales) {
      if (saleLineMonth.get(s.id) === m) {
        const flow = flowsByItem.get(s.itemId);
        if (flow) {
          flow.SQ = flow.SQ.plus(s.qty);
        }
      }
    }

    // 7: Consumed raw materials in batches completed in month m
    for (const b of postedBatches) {
      if (batchMonth.get(b.id) === m) {
        for (const mat of b.materials) {
          const flow = flowsByItem.get(mat.rawItemId);
          if (flow) {
            flow.CQ = flow.CQ.plus(mat.consumedQty);
          }
        }
      }
    }

    // 8: Stock issues in month m
    for (const iss of postedStockIssues) {
      if (stockIssueMonth.get(iss.id) === m) {
        const flow = flowsByItem.get(iss.itemId);
        if (flow) {
          flow.ISSUE_Q = flow.ISSUE_Q.plus(iss.qty);
        }
      }
    }

    // -------------------------------------------------------------
    // Step (A): Compute Raw Path for all items in month m
    // -------------------------------------------------------------
    const rawPathResults = new Map<
      string,
      {
        RAW_POOL_Q: Decimal;
        RAW_POOL_V: Decimal;
        RAVG: Decimal;
        RQ: Decimal;
        RV: Decimal;
      }
    >();

    for (const it of items) {
      const flow = flowsByItem.get(it.id)!;
      let rawPoolQ: Decimal;
      let rawPoolV: Decimal;

      if (m === 1) {
        rawPoolQ = it.openingQty.plus(flow.PQ).minus(flow.PRS_Q).plus(flow.SR_PRIOR_Q);
        rawPoolV = it.openingValue.plus(flow.PV).minus(flow.PRS_V).plus(flow.RAW_SR_PRIOR_V);
      } else {
        const prevState = itemStates.get(it.id)![m - 2];
        rawPoolQ = prevState.RQ.plus(flow.PQ).minus(flow.PRS_Q).plus(flow.SR_PRIOR_Q);
        rawPoolV = prevState.RV.plus(flow.PV).minus(flow.PRS_V).plus(flow.RAW_SR_PRIOR_V);
      }

      let ravg: Decimal;
      if (isQtyZero(rawPoolQ)) {
        ravg = zero();
      } else {
        ravg = rawPoolV.div(rawPoolQ);
      }

      const rq = rawPoolQ
        .minus(flow.SQ)
        .plus(flow.SR_SAME_Q)
        .minus(flow.CQ)
        .minus(flow.PRP_Q)
        .minus(flow.ISSUE_Q);

      const rv = rq.mul(ravg);

      rawPathResults.set(it.id, {
        RAW_POOL_Q: rawPoolQ,
        RAW_POOL_V: rawPoolV,
        RAVG: ravg,
        RQ: rq,
        RV: rv,
      });
    }

    // -------------------------------------------------------------
    // Step (B): Compute Manufacturing Batches in month m
    // -------------------------------------------------------------
    const mqByItem = new Map<string, Decimal>();
    const mvByItem = new Map<string, Decimal>();

    for (const it of items) {
      mqByItem.set(it.id, zero());
      mvByItem.set(it.id, zero());
    }

    for (const b of postedBatches) {
      if (batchMonth.get(b.id) === m) {
        let batchCost = zero();
        for (const mat of b.materials) {
          const rawResult = rawPathResults.get(mat.rawItemId);
          const rawAvg = rawResult ? rawResult.RAVG : zero();
          batchCost = batchCost.plus(mat.consumedQty.mul(rawAvg));
        }

        const currMq = mqByItem.get(b.finishedItemId) ?? zero();
        const currMv = mvByItem.get(b.finishedItemId) ?? zero();
        mqByItem.set(b.finishedItemId, currMq.plus(b.producedQty));
        mvByItem.set(b.finishedItemId, currMv.plus(batchCost));
      }
    }

    // -------------------------------------------------------------
    // Step (C): Compute General Path for all items in month m
    // -------------------------------------------------------------
    for (const it of items) {
      const flow = flowsByItem.get(it.id)!;
      const rawRes = rawPathResults.get(it.id)!;
      const mq = mqByItem.get(it.id) ?? zero();
      const mv = mvByItem.get(it.id) ?? zero();

      let oq: Decimal;
      let ov: Decimal;

      if (m === 1) {
        oq = it.openingQty;
        ov = it.openingValue;
      } else {
        const prevState = itemStates.get(it.id)![m - 2];
        oq = prevState.EQ;
        ov = prevState.EV;
      }

      let poolQ: Decimal;
      let poolV: Decimal;
      let avg: Decimal;
      let eq: Decimal;
      let ev: Decimal;

      if (it.role === 'RAW') {
        poolQ = rawRes.RAW_POOL_Q;
        poolV = rawRes.RAW_POOL_V;
        avg = rawRes.RAVG;
        eq = rawRes.RQ;
        ev = rawRes.RV;
      } else {
        poolQ = oq.plus(flow.PQ).minus(flow.PRS_Q).plus(mq).plus(flow.SR_PRIOR_Q);
        poolV = ov.plus(flow.PV).minus(flow.PRS_V).plus(mv).plus(flow.SR_PRIOR_V);

        if (isQtyZero(poolQ)) {
          avg = zero();
        } else {
          avg = poolV.div(poolQ);
        }

        eq = poolQ
          .minus(flow.SQ)
          .plus(flow.SR_SAME_Q)
          .minus(flow.CQ)
          .minus(flow.PRP_Q)
          .minus(flow.ISSUE_Q);

        ev = eq.mul(avg);
      }

      // COST_CHECK validation
      let costCheck = '';
      if (poolQ.lt(QTY_EPSILON.neg()) || poolV.lt(MONEY_EPSILON.neg())) {
        costCheck = 'وعاء تكلفة سالب';
      } else if (isQtyZero(poolQ) && !isMoneyZero(poolV)) {
        costCheck = 'وعاء صفري بغير قيمة صفرية';
      } else if (eq.lt(QTY_EPSILON.neg())) {
        costCheck = 'مخزون سالب';
      }

      const state: ItemMonthCostingState = {
        itemId: it.id,
        monthIndex: m,
        PQ: flow.PQ,
        PV: flow.PV,
        PRS_Q: flow.PRS_Q,
        PRS_V: flow.PRS_V,
        PRP_Q: flow.PRP_Q,
        SQ: flow.SQ,
        CQ: flow.CQ,
        ISSUE_Q: flow.ISSUE_Q,
        SR_SAME_Q: flow.SR_SAME_Q,
        SR_PRIOR_Q: flow.SR_PRIOR_Q,
        RAW_SR_PRIOR_V: flow.RAW_SR_PRIOR_V,
        SR_PRIOR_V: flow.SR_PRIOR_V,
        RAW_POOL_Q: rawRes.RAW_POOL_Q,
        RAW_POOL_V: rawRes.RAW_POOL_V,
        RAVG: rawRes.RAVG,
        RQ: rawRes.RQ,
        RV: rawRes.RV,
        MQ: mq,
        MV: mv,
        OQ: oq,
        OV: ov,
        POOL_Q: poolQ,
        POOL_V: poolV,
        AVG: avg,
        EQ: eq,
        EV: ev,
        COST_CHECK: costCheck,
      };

      itemStates.get(it.id)!.push(state);
    }
  }

  // -------------------------------------------------------------
  // Lookup helper functions
  // -------------------------------------------------------------
  function getItemMonthlyAvgCost(itemId: string, monthIndex: number): Decimal {
    const states = itemStates.get(itemId);
    if (!states || states.length === 0) return zero();
    const idx = Math.min(Math.max(1, monthIndex), states.length) - 1;
    return states[idx].AVG;
  }

  function getItemEndingState(itemId: string, monthIndex: number): ItemMonthCostingState {
    const states = itemStates.get(itemId);
    if (!states || states.length === 0) {
      throw new Error(`Item ${itemId} not found in costing engine states`);
    }
    const idx = Math.min(Math.max(1, monthIndex), states.length) - 1;
    return states[idx];
  }

  function getSaleLineCOGS(saleLineId: string): Decimal {
    const s = saleLineMap.get(saleLineId);
    if (!s || s.status === 'VOID') return zero();
    const m = saleLineMonth.get(s.id) ?? getMonthIndex(s.invoiceDate, startYear);
    const avg = getItemMonthlyAvgCost(s.itemId, m);
    return s.qty.mul(avg);
  }

  function getReturnSalesCost(returnLineId: string): Decimal {
    const r = postedReturns.find((x) => x.id === returnLineId);
    if (!r || r.type !== 'SALE_RETURN' || !r.sourceSaleLineId) return zero();
    const src = saleLineMap.get(r.sourceSaleLineId);
    if (!src) return zero();
    const srcM = returnLineSourceMonth.get(r.id) ?? getMonthIndex(src.invoiceDate, startYear);
    const avg = getItemMonthlyAvgCost(src.itemId, srcM);
    return r.qty.mul(avg);
  }

  function getDamagedReturnExpense(returnLineId: string): Decimal {
    const r = postedReturns.find((x) => x.id === returnLineId);
    if (!r || r.type !== 'SALE_RETURN' || r.saleReturnCondition !== 'DAMAGED') return zero();
    return getReturnSalesCost(returnLineId);
  }

  function getInventoryOutCost(returnLineId: string): Decimal {
    const r = postedReturns.find((x) => x.id === returnLineId);
    if (!r || r.type !== 'PURCHASE_RETURN' || !r.sourcePurchaseLineId) return zero();
    const src = purchaseLineMap.get(r.sourcePurchaseLineId);
    if (!src) return zero();
    const retM = returnLineReturnMonth.get(r.id) ?? getMonthIndex(r.returnDate, startYear);
    const srcM = returnLineSourceMonth.get(r.id) ?? getMonthIndex(src.invoiceDate, startYear);
    const origUnitPrice = returnLineOriginalNetUnitPrice.get(r.id) ?? zero();

    if (srcM === retM) {
      // Same month: returned at original unit purchase cost
      return r.qty.mul(origUnitPrice);
    } else {
      // Prior month: returned at current return month AVG
      const curAvg = getItemMonthlyAvgCost(src.itemId, retM);
      return r.qty.mul(curAvg);
    }
  }

  function getPurchaseVariance(returnLineId: string): Decimal {
    const r = postedReturns.find((x) => x.id === returnLineId);
    if (!r || r.type !== 'PURCHASE_RETURN' || !r.sourcePurchaseLineId) return zero();
    const src = purchaseLineMap.get(r.sourcePurchaseLineId);
    if (!src) return zero();
    const origUnitPrice = returnLineOriginalNetUnitPrice.get(r.id) ?? zero();

    const purchaseCredit =
      r.supplierCreditNote !== null && r.supplierCreditNote !== undefined
        ? r.supplierCreditNote
        : r.qty.mul(origUnitPrice);

    const invOutCost = getInventoryOutCost(returnLineId);
    return purchaseCredit.minus(invOutCost);
  }

  function getStockIssueCost(stockIssueId: string): Decimal {
    const iss = postedStockIssues.find((x) => x.id === stockIssueId);
    if (!iss) return zero();
    const m = stockIssueMonth.get(iss.id) ?? getMonthIndex(iss.issueDate, startYear);
    const avg = getItemMonthlyAvgCost(iss.itemId, m);
    return iss.qty.mul(avg);
  }

  return {
    startYear,
    maxMonthIndex: maxMonth,
    itemStates,
    getItemMonthlyAvgCost,
    getItemEndingState,
    getSaleLineCOGS,
    getReturnSalesCost,
    getDamagedReturnExpense,
    getInventoryOutCost,
    getPurchaseVariance,
    getStockIssueCost,
  };
}
