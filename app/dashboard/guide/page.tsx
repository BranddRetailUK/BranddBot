export default function GuidePage() {
  return (
    <div className="stack">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Beginner Guide</span>
            <h2>Trading Terms Used In BranddBot</h2>
          </div>
        </div>
        <div className="panelBody guideGrid">
          <GuideTerm title="Paper trading">
            Simulated trading. Orders go to the Alpaca paper account, not a real-money account.
          </GuideTerm>
          <GuideTerm title="Symbol">
            A short market code for something traded. AAPL is Apple, MSFT is Microsoft, SPY is an ETF that tracks the S&P
            500.
          </GuideTerm>
          <GuideTerm title="ETF">
            Exchange-traded fund. It trades like a stock but usually represents a basket of investments.
          </GuideTerm>
          <GuideTerm title="RSI">
            Relative Strength Index. A number from 0 to 100 that compares recent upward and downward price movement.
          </GuideTerm>
          <GuideTerm title="Oversold">
            A low RSI area. It can mean sellers pushed the price down quickly, but it does not guarantee a bounce.
          </GuideTerm>
          <GuideTerm title="Overbought">
            A high RSI area. It can mean buyers pushed the price up quickly, but it does not guarantee a drop.
          </GuideTerm>
          <GuideTerm title="Notional">
            The dollar size of a trade. A $10 notional buy means buying around ten dollars of that symbol.
          </GuideTerm>
          <GuideTerm title="Position">
            What the account currently holds. If the bot bought $10 of AAPL, that creates an AAPL position.
          </GuideTerm>
          <GuideTerm title="Realized profit/loss">
            Profit or loss counted after a position is closed. Open positions have unrealized profit/loss because they can
            still change.
          </GuideTerm>
          <GuideTerm title="Risk gate">
            The final safety layer. It checks order size, confidence, paper-only mode, daily loss, and whether AI agrees with
            RSI.
          </GuideTerm>
          <GuideTerm title="Catalyst">
            A news event that might explain why traders are watching a symbol, such as earnings, a product launch, or a
            regulatory issue.
          </GuideTerm>
          <GuideTerm title="Confidence">
            A score from 0 to 1. Higher means the system is more comfortable with the decision, but it is not a guarantee.
          </GuideTerm>
        </div>
      </section>
    </div>
  );
}

function GuideTerm({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="guideTerm">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
