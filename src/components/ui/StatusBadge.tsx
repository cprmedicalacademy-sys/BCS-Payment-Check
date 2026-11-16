import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { GroupStatus, PaymentStatus, VerificationStatus } from '../../types/portal';

type AnyStatus = VerificationStatus | PaymentStatus | GroupStatus | string;

export const StatusLabel: React.FC<{ status: AnyStatus; compact?: boolean }> = ({
  status,
  compact = false,
}) => {
  const getMeta = (s: AnyStatus) => {
    switch (s) {
      case 'Approved':
      case 'WhatsApp Group Added':
      case 'Verified':
      case 'Fully Paid':
      case 'Added':
        return {
          text: 'text-[#0F766E]',
          bg: 'bg-[#F0FDFA] border-[#99F6E4]',
          Icon: CheckCircle2,
        };
      case 'Payment Verified':
      case 'Eligible to Add':
        return {
          text: 'text-[#1D5FA7]',
          bg: 'bg-[#EFF6FF] border-[#BFDBFE]',
          Icon: ShieldCheck,
        };
      case 'Payment Due':
      case 'Due':
      case 'Partially Paid':
      case 'Contact Needed':
        return {
          text: 'text-amber-800',
          bg: 'bg-amber-50 border-amber-200',
          Icon: AlertCircle,
        };
      case 'Rejected / Contact Office':
        return {
          text: 'text-red-800',
          bg: 'bg-red-50 border-red-200',
          Icon: XCircle,
        };
      case 'Under Review':
        return {
          text: 'text-slate-700',
          bg: 'bg-slate-100 border-slate-200',
          Icon: Clock,
        };
      default:
        return {
          text: 'text-slate-700',
          bg: 'bg-slate-50 border-slate-200',
          Icon: s.includes('Added') ? MessageSquare : Clock,
        };
    }
  };

  const { text, bg, Icon } = getMeta(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${bg} ${text} ${
        compact ? 'text-[11px]' : ''
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};
