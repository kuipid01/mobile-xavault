export type EnvelopeType = "locked" | "flexible";

export type SubEnvelope = {
  id: string;
  name: string;
  amount: number;
  unlocked: number;
  spent?: number;
};

export type Envelope = {
  id: string;
  name: string;
  icon: string;
  amount: number;
  balance: number;
  type: EnvelopeType;
  children?: SubEnvelope[];
};

export type PlanStatus = "active" | "draft" | "completed" | "cancelled";

export type Plan = {
  id: string;
  title: string;
  endDate?: string;
  progress?: number;
  targetAmount: number;
  allocatedAmount?: number;
  status: PlanStatus;
  envelopes: Envelope[];
};

export const plans: Plan[] = [
  {
    id: "july-salary",
    title: "July Salary Plan",
    endDate: "July 31",
    progress: 100,
    targetAmount: 250000,
    allocatedAmount: 190000,
    status: "active",
    envelopes: [
      {
        id: "rent",
        name: "Rent",
        icon: "home-outline",
        amount: 100000,
        balance: 0,
        type: "locked",
      },
      {
        id: "food",
        name: "Food",
        icon: "restaurant-outline",
        amount: 60000,
        balance: 15000,
        type: "flexible",
        children: [
          {
            id: "groceries",
            name: "Groceries",
            amount: 35000,
            unlocked: 10000,
          },
          {
            id: "eating-out",
            name: "Eating Out",
            amount: 10000,
            unlocked: 5000,
          },
        ],
      },
      {
        id: "transport",
        name: "Transport",
        icon: "car-outline",
        amount: 30000,
        balance: 30000,
        type: "flexible",
      },
    ],
  },
  {
    id: "august-salary",
    title: "August Salary Plan",
    endDate: "3 envelopes added",
    targetAmount: 300000,
    status: "draft",
    envelopes: [],
  },
];

export const formatMoney = (value: number) => {
  return `₦${value.toLocaleString()}`;
};