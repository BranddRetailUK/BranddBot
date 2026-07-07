export function SymbolIdentity({ symbol, companyName }: { symbol: string; companyName?: string }) {
  return (
    <div className="symbolIdentity">
      <span className="tickerBadge">{symbol}</span>
      {companyName ? <span className="companyName">{companyName}</span> : null}
    </div>
  );
}
