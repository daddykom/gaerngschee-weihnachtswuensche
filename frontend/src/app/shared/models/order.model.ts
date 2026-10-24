export interface OrderItem {
  id: string;
  orderId: string;
  originalDescription: string;
  currentDescription: string;
  originalReason: string | null;
  currentReason: string | null;
  status: string;
  fulfillerEmail: string | null;
  reservedAt: string | null;
  dueAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Order {
  id: string;
  userId: string;
  year: number;
  status: string;
  adultsCount: number;
  childrenCount: number;
  originalText: string | null;
  currentText: string | null;
  items: OrderItem[];
  fairgateStatus: string | null;
  confirmationEmailSentAt: string | null;
  fairgateReminderEmailSentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrderOverviewResponse {
  order: Order | null;
  year: number;
  fairgateStatus: string;
  fairgateUserExists: boolean;
  childrenCount: number | null;
  adultsCount: number | null;
}

export interface OrderFormValue {
  password: string;
  passwordConfirmation: string;
  adultsCount: number | null;
  childrenCount: number | null;
  text: string;
}
