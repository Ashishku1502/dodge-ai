import { Zap, MessageSquare, Package, Truck, Receipt, FileText, CreditCard, User, Box } from 'lucide-react';

export const NODE_TYPES = {
  SalesOrder: { color: '#3b82f6', label: 'Sales Order', icon: Zap },
  Delivery: { color: '#a855f7', label: 'Delivery', icon: Truck },
  Billing: { color: '#0ea5e9', label: 'Invoice', icon: Receipt },
  JournalEntry: { color: '#10b981', label: 'Journal Entry', icon: FileText },
  Payment: { color: '#f59e0b', label: 'Payment', icon: CreditCard },
  Partner: { color: '#ec4899', label: 'Partner', icon: User },
  Product: { color: '#ef4444', label: 'Product', icon: Box },
};

export const DEFAULT_LINK_COLOR = '#475569';
export const HIGHLIGHT_COLOR = '#60a5fa';
export const HIGHLIGHT_WIDTH = 2;
