export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
};

export type Wallet = {
  id: string;
  user_id: string;
  available_balance: number;
  locked_balance: number;
  ledger_balance: number;
  currency: string;
  paystack_customer_code?: string;
  dedicated_account_id?: string;
  dedicated_account_number?: string;
  dedicated_account_name?: string;
  dedicated_bank_name?: string;
  dedicated_bank_slug?: string;
  created_at: string;
  updated_at: string;
};

export type WalletDeposit = {
  id: string;
  user_id: string;
  wallet_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  created_at: string;
  updated_at: string;
};

export type WalletLedger = {
  id: string;
  user_id: string;
  wallet_id: string;
  currency: string;
	Currency?: string;
  reference: string;
	Reference?: string;
  Type?: string;
  Source?: string;
  Amount?: number;
  BalanceBefore?: number;
  BalanceAfter?: number;
  Description?: string;
  CreatedAt?: string;
  type?: string;
  source?: string;
  source_id?: string;
  SourceID?: string;
  amount?: number;
  balance_before?: number;
  balance_after?: number;
  description?: string;
  created_at?: string;
};

export type DepositInitResponse = {
  authorization_url?: string;
  access_code?: string;
  reference?: string;
  provider_response?: unknown;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

export type DepositVerificationResponse = {
  status: "success" | "pending" | "failed";
  reference: string;
  deposit?: WalletDeposit;
};

export type PlanStatus = "draft" | "active" | "completed" | "cancelled" | "expired";
export type UnboxedBalancePolicy =
  | "flexible"
  | "locked_until_plan_ends"
  | "locked_until_parent_ends";

export type Plan = {
  id: string;
  user_id: string;
  wallet_id: string;
  name: string;
  amount: number;
  currency: string;
  status: PlanStatus;
  unboxed_balance_policy: UnboxedBalancePolicy;
  start_date: string;
  end_date: string;
  top_level_allocated: number;
  plan_unboxed_balance: number;
  withdrawn_amount?: number;
  pending_withdrawal_amount?: number;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ListPlansResponse = {
  items: Plan[];
  pagination: Pagination;
};

export type Envelope = {
  id: string;
  user_id: string;
  plan_id: string;
  parent_envelope_id?: string | null;
  name: string;
  amount: number;
  status: string;
  unboxed_balance_policy: UnboxedBalancePolicy;
  start_date: string;
  end_date: string;
  allocated_to_children: number;
  unboxed_balance: number;
  withdrawn_amount?: number;
  pending_withdrawal_amount?: number;
  children?: Envelope[];
  created_at: string;
  updated_at: string;
};

export type PlanPreview = {
  can_confirm: boolean;
  plan_id: string;
  plan_amount: number;
  wallet_available: number;
  top_level_allocated: number;
  plan_unboxed_balance: number;
  unboxed_policy: string;
  validation_errors: {
    code: string;
    message: string;
    field?: string;
    entity_id?: string;
    entity?: string;
    shortage?: number;
  }[];
  envelope_tree: Envelope[];
};
