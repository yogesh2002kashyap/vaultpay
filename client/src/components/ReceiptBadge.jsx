export const ReceiptBadge = ({ status }) => {
  const normalized = status || 'unavailable';
  const config = {
    available: { label: 'Receipt Ready', className: 'receipt-pill available' },
    generating: { label: 'Generating', className: 'receipt-pill generating' },
    unavailable: { label: 'Unavailable', className: 'receipt-pill unavailable' },
  };

  const current = config[normalized] || config.unavailable;

  return <span className={current.className}>{current.label}</span>;
};
