import { Decimal } from './decimal';

// ==========================================
// Base Enums (Mirroring Database Schema Enums)
// ==========================================

export type RecordStatus = 'POSTED' | 'VOID';

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'CASHIER';

export type PartyType = 'CLIENT' | 'SUPPLIER' | 'DRIVER' | 'PARTNER' | 'FUNDER';

export type ItemRole = 'MERCHANDISE' | 'RAW' | 'FINISHED';

export type SaleLineType = 'SALE' | 'DRIVER_GIFT';

export type CashAccountType = 'CASH' | 'BANK';

export type CashTransactionType =
  | 'CUSTOMER_COLLECTION'
  | 'CUSTOMER_REFUND'
  | 'SUPPLIER_PAYMENT'
  | 'SUPPLIER_REFUND'
  | 'CASH_EXPENSE'
  | 'DRIVER_AMOUNT'
  | 'DRIVER_CASH_GIFT'
  | 'EXTERNAL_SALES_PROFIT'
  | 'ASSET_PURCHASE'
  | 'PARTNER_CONTRIBUTION'
  | 'PARTNER_DRAWING'
  | 'PROFIT_DISTRIBUTION'
  | 'LOAN_RECEIVED'
  | 'LOAN_REPAYMENT'
  | 'OWNER_BROTHER_FINANCING'
  | 'OWNER_BROTHER_REPAYMENT'
  | 'INTERNAL_TRANSFER';

export type ReturnType = 'SALE_RETURN' | 'PURCHASE_RETURN';

export type SaleReturnCondition = 'GOOD' | 'DAMAGED';

export type StockIssueType = 'TESTER' | 'SAMPLE' | 'DAMAGED';

// ==========================================
// Domain Input Entities (Pure TypeScript)
// ==========================================

export interface SystemSettingDomain {
  startYear: number;
  openingCash: Decimal;
  openingBank: Decimal;
  openingReviewed: boolean;
  approveOpeningAssets: boolean;
  openingLoans: Decimal;
  openingRetainedEarnings: Decimal;
  allowNegativeStock: boolean;
  lockedThroughDate?: string | null;
}

export interface ItemDomain {
  id: string;
  code: string;
  name: string;
  role: ItemRole;
  openingQty: Decimal;
  openingValue: Decimal;
  categoryId?: string;
  unitId?: string;
  reorderLevel?: Decimal;
  isActive?: boolean;
}

export interface PartyDomain {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  type: PartyType;
  openingInvoice?: Decimal;
  openingPaid?: Decimal;
  openingBalance: Decimal; // + client debt / supplier credit (we owe), - credit
  profitShareRatio?: Decimal; // e.g. 0.60 for 60%
  openingCapital?: Decimal;
  carryoverReferrals?: number;
  isDriverGiftEnabled?: boolean;
  isActive?: boolean;
}

export interface FixedAssetDomain {
  id: string;
  code: string;
  name: string;
  acquiredDate?: string | null;
  submittedValue: Decimal;
  isActive?: boolean;
}

export interface GiftPolicyDomain {
  id: string;
  effectiveDate: string; // YYYY-MM-DD
  customersPerGift: number; // e.g. 10
  giftValue: Decimal; // e.g. 100,000
}

export interface PurchaseLineDomain {
  id: string;
  code: string; // P000001
  invoiceId: string;
  invoiceKey: string; // "2026 | P-1001"
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  supplierId: string;
  dueDate?: string | null;
  itemId: string;
  qty: Decimal;
  unitCost: Decimal;
  landedCost: Decimal;
  discount: Decimal;
  lineTotalCost: Decimal; // qty * unitCost + landedCost - discount
  status: RecordStatus;
}

export interface SaleLineDomain {
  id: string;
  code: string; // S000001
  invoiceId: string;
  invoiceKey: string; // "2026 | S-1001"
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  customerId?: string | null;
  dueDate?: string | null;
  lineType: SaleLineType; // SALE | DRIVER_GIFT
  itemId: string;
  qty: Decimal;
  unitPrice: Decimal;
  discount: Decimal;
  netSaleAmount: Decimal; // in SALE: qty * unitPrice - discount, in DRIVER_GIFT: 0
  driverId?: string | null;
  driverGiftSettlementValue: Decimal;
  status: RecordStatus;
}

export interface ReturnLineDomain {
  id: string;
  code: string; // R000001
  returnDocNo: string; // RT-001
  returnDate: string; // YYYY-MM-DD
  type: ReturnType; // SALE_RETURN | PURCHASE_RETURN
  partyId: string;
  invoiceKey: string; // "2026 | S-1001" or "2026 | P-1001"
  sourceSaleLineId?: string | null;
  sourcePurchaseLineId?: string | null;
  qty: Decimal;
  saleReturnCondition?: SaleReturnCondition | null; // GOOD | DAMAGED
  supplierCreditNote?: Decimal | null;
  reason: string;
  status: RecordStatus;
}

export interface StockIssueDomain {
  id: string;
  code: string; // IS000001
  issueDate: string; // YYYY-MM-DD
  type: StockIssueType;
  itemId: string;
  qty: Decimal;
  reason: string;
  testerRef?: string | null;
  status: RecordStatus;
}

export interface BatchMaterialDomain {
  id: string;
  batchId: string;
  rawItemId: string;
  consumedQty: Decimal;
}

export interface ProductionBatchDomain {
  id: string;
  code: string; // B-001
  completionDate: string; // YYYY-MM-DD
  finishedItemId: string;
  producedQty: Decimal;
  materials: BatchMaterialDomain[];
  status: RecordStatus;
}

export interface CashTransactionDomain {
  id: string;
  code: string; // C000001
  txDate: string; // YYYY-MM-DD
  type: CashTransactionType;
  account: CashAccountType; // CASH | BANK
  transferToAccount?: CashAccountType | null;
  amount: Decimal;
  partyId?: string | null;
  invoiceKey?: string | null;
  assetId?: string | null;
  description?: string | null;
  status: RecordStatus;
}

export interface DriverReferralDomain {
  id: string;
  code: string; // VIS000001
  visitDate: string; // YYYY-MM-DD
  visitorUniqueKey: string;
  visitorName: string;
  driverId: string;
  status: RecordStatus;
}

// ==========================================
// Costing Engine 27 Monthly Variables per Item
// ==========================================

export interface ItemMonthCostingState {
  itemId: string;
  monthIndex: number; // 1-based index from startYear

  // 1-12: Flows in month m
  PQ: Decimal; // Purchases Qty
  PV: Decimal; // Purchases Value (cost total)
  PRS_Q: Decimal; // Same-month purchase return qty
  PRS_V: Decimal; // Same-month purchase return value
  PRP_Q: Decimal; // Prior-month purchase return qty
  SQ: Decimal; // Sales Qty (including SALE & DRIVER_GIFT)
  CQ: Decimal; // Consumed raw qty in manufacturing batches
  ISSUE_Q: Decimal; // Stock issues qty
  SR_SAME_Q: Decimal; // Good sales return qty from same month
  SR_PRIOR_Q: Decimal; // Good sales return qty from prior months
  RAW_SR_PRIOR_V: Decimal; // Good sales return value from prior months on raw path
  SR_PRIOR_V: Decimal; // Good sales return value from prior months on general path

  // 13-17: Stage (A) Raw Path
  RAW_POOL_Q: Decimal;
  RAW_POOL_V: Decimal;
  RAVG: Decimal;
  RQ: Decimal;
  RV: Decimal;

  // 18-19: Stage (B) Manufacturing Batches
  MQ: Decimal; // Produced qty added
  MV: Decimal; // Produced value added (sum of consumed materials * RAVG)

  // 20-27: Stage (C) General Path
  OQ: Decimal; // Opening Qty for month
  OV: Decimal; // Opening Value for month
  POOL_Q: Decimal;
  POOL_V: Decimal;
  AVG: Decimal; // Approved monthly weighted average cost
  EQ: Decimal; // Ending available Qty
  EV: Decimal; // Ending Value
  COST_CHECK: string; // "" (OK) | "وعاء تكلفة سالب" | "وعاء صفري بغير قيمة صفرية" | "مخزون سالب"
}

export interface CostingResult {
  startYear: number;
  maxMonthIndex: number;
  // Map of itemId -> array of states for monthIndex 1..maxMonthIndex
  itemStates: Map<string, ItemMonthCostingState[]>;
  getItemMonthlyAvgCost: (itemId: string, monthIndex: number) => Decimal;
  getItemEndingState: (itemId: string, monthIndex: number) => ItemMonthCostingState;
  getSaleLineCOGS: (saleLineId: string) => Decimal;
  getReturnSalesCost: (returnLineId: string) => Decimal;
  getDamagedReturnExpense: (returnLineId: string) => Decimal;
  getInventoryOutCost: (returnLineId: string) => Decimal;
  getPurchaseVariance: (returnLineId: string) => Decimal;
  getStockIssueCost: (stockIssueId: string) => Decimal;
}

// ==========================================
// Balances & Aging Types
// ==========================================

export type AgingCategory =
  | 'رصيد دائن'
  | 'مسدد'
  | 'استحقاق غير محدد'
  | 'غير مستحق'
  | '1–30'
  | '31–60'
  | '61–90'
  | 'أكثر من90';

export type ReportClass = 'رصيد افتتاحي' | 'مقدم على فاتورة لاحقة' | 'فاتورة';

export type CoverageStatus = 'متوازن' | 'مستحق يقابله دائن' | 'مستحق' | 'رصيد دائن';

export interface InvoiceBalanceItem {
  partyId: string;
  partyCode: string;
  partyName: string;
  partyNameEn?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  partyType: PartyType;
  invoiceKey: string; // e.g. "2026 | S-1001" or "افتتاحي"
  invoiceDate?: string | null;
  dueDate?: string | null;
  reportClass: ReportClass;
  originalAsOf: Decimal;
  returnsAsOf: Decimal;
  settlementAsOf: Decimal;
  refundAsOf: Decimal;
  signedAsOf: Decimal;
  invoiceDebt: Decimal;
  invoiceCredit: Decimal;
  daysOverdue: number;
  aging: AgingCategory;
}

export interface PartySummaryItem {
  partyId: string;
  partyCode: string;
  partyName: string;
  partyNameEn?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  partyType: PartyType;
  totalInvoicedAsOf: Decimal;
  totalSettledAsOf: Decimal;
  partyDebtAsOf: Decimal;
  partyCreditAsOf: Decimal;
  partySignedAsOf: Decimal;
  uncoveredAsOf: Decimal;
  coverageAsOf: CoverageStatus;
  prepaymentAsOf: Decimal;
  unallocatedAsOf: Decimal;
  reconciliationAsOf: Decimal;
}

export interface CreditBeforeResult {
  partyId: string;
  invoiceKey: string;
  creditBefore: Decimal;
  refundLimitValid: boolean;
  priorCollectionsOrPayments: Decimal;
  priorRefunds: Decimal;
  origDebtOrPayable: Decimal;
  retCredit: Decimal;
}

// ==========================================
// Driver Gifts Types
// ==========================================

export interface DriverVisitCalculation {
  visitId: string;
  visitCode: string;
  visitDate: string;
  visitorUniqueKey: string;
  visitorName: string;
  driverId: string;
  activePolicy: GiftPolicyDomain;
  calcBefore: number;
  calcGifts: number;
  calcConsumed: number;
  calcAfter: number;
  calcAmount: Decimal;
}

export interface DriverGiftSummaryItem {
  driverId: string;
  driverCode: string;
  driverName: string;
  driverNameEn?: string | null;
  carryoverReferrals: number;
  registeredClients: number;
  totalGiftsEarned: number;
  totalAccruedAmount: Decimal;
  totalReceivedAmount: Decimal;
  remainingBalance: Decimal;
  lastRemainder: number;
  clientsNeededForNextGift: number;
}

// ==========================================
// Reports & Dashboard Types
// ==========================================

export interface IncomeStatementCards {
  netSales: Decimal; // B10
  netCOGS: Decimal; // B11
  grossProfit: Decimal; // B12
  cashOperatingExpenses: Decimal; // B13
  inventoryLossesAndIssues: Decimal; // Issues + Damaged Returns
  otherOperatingAdditions: Decimal; // Purchase Variance + External Sales Profit
  operatingProfit: Decimal; // B14
  inventoryValue: Decimal; // B15
  cashAndBankTotal: Decimal; // B16
  cashBalance: Decimal;
  bankBalance: Decimal;
  clientDebtTotal: Decimal; // B17
  supplierDebtTotal: Decimal; // J9
  clientCreditTotal: Decimal; // J10
  supplierCreditTotal: Decimal; // J11
  openingEquityDiff: Decimal; // J16 (must be 0)
  cumulativeOperatingProfitSinceStart: Decimal; // B35
}

export interface MonthlyComparisonRow {
  monthIndex: number;
  year: number;
  month: number;
  monthName: string;
  netSales: Decimal;
  cogs: Decimal;
  grossProfit: Decimal;
  cashExpenses: Decimal;
  operatingProfit: Decimal;
  endingInventoryValue: Decimal;
}

export interface CategorySalesRow {
  categoryId: string;
  categoryName: string;
  categoryPrefix: string;
  netSales: Decimal;
}

export interface PartnerEquityItem {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  partnerNameEn?: string | null;
  openingCapital: Decimal;
  contributions: Decimal;
  drawings: Decimal;
  profitsReceived: Decimal;
  profitShareRatio: Decimal;
  cumulativeProfitShare: Decimal;
  currentCapital: Decimal;
  undistributedProfit: Decimal;
}

export interface OpeningEquitySummary {
  openingCash: Decimal;
  openingBank: Decimal;
  openingInventoryValue: Decimal;
  openingClientDebt: Decimal;
  approvedOpeningAssets: Decimal;
  openingSupplierDebt: Decimal;
  openingLoans: Decimal;
  openingFunderDebt: Decimal;
  openingEquity: Decimal;
  allocatedPartnerCapital: Decimal;
  openingRetainedEarnings: Decimal;
  allocatedPartnerEquity: Decimal;
  openingEquityDiff: Decimal;
}
