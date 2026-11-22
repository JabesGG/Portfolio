import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { Panel } from "@/components/Lamp";
import { BRANDS } from "@/lib/store";
import { afterDiscount, fuelSavings } from "@/lib/calc";
import { dmy, money, num, todayISO } from "@/lib/format";

/**
 * Fuel-card discounts and a pump-price comparison. Singapore has no public feed
 * of pump prices, so the prices are the ones you type in from the forecourt
 * signs; what this adds is the ranking after your own discounts, which the
 * signs never show.
 */
export function FuelPanel() {
  const { s, g, updateGarage, toast } = useApp();
  const [disc, setDisc] = useState<Record<string, string>>(() =>
    Object.fromEntries(BRANDS.map(b => [b, g.prefs.fuelDiscounts[b] ? String(g.prefs.fuelDiscounts[b]) : ""])));
  const [price, setPrice] = useState<Record<string, string>>(() =>
    Object.fromEntries(BRANDS.map(b => [b, g.prefs.pumpPrices?.ron95[b] ? String(g.prefs.pumpPrices.ron95[b]) : ""])));

  const savedDisc = JSON.stringify(Object.fromEntries(BRANDS.map(b => [b, num(g.prefs.fuelDiscounts[b])])));
  const draftDisc = JSON.stringify(Object.fromEntries(BRANDS.map(b => [b, num(disc[b])])));
  const savedPrice = JSON.stringify(Object.fromEntries(BRANDS.map(b => [b, num(g.prefs.pumpPrices?.ron95[b])])));
  const draftPrice = JSON.stringify(Object.fromEntries(BRANDS.map(b => [b, num(price[b])])));

  const ranked = BRANDS
    .filter(b => num(g.prefs.pumpPrices?.ron95[b]) > 0)
    .map(b => {
      const pump = num(g.prefs.pumpPrices!.ron95[b]);
      const pct = num(g.prefs.fuelDiscounts[b]);
      // Three decimals: pump prices are quoted to the tenth of a cent.
      return { b, pump, pct, net: Math.round(pump * (100 - Math.min(100, pct)) * 10) / 1000 };
    })
    .sort((a, c) => a.net - c.net);
  const saved = fuelSavings(s);
  const tank = num(s.bike.tank);

  return (
    <>
      <Panel title="Fuel-card discounts" note={saved > 0 ? `${money(saved)} saved` : undefined}>
        <p className="field__h !mt-0 mb-3">
          The percentage you really get at each brand, after your card or membership. When you log
          a fill at that brand, type the pump total and the app works out what you paid.
        </p>
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-2">
          {BRANDS.map(b => (
            <div key={b}>
              <label className="mini__l">{b} %</label>
              <input className="inp inp--sm" inputMode="decimal" placeholder="0" value={disc[b]}
                     onChange={e => setDisc({ ...disc, [b]: e.target.value })} />
            </div>
          ))}
        </div>
        {draftDisc !== savedDisc && (
          <button className="btn btn--sm w-full mt-3"
                  onClick={() => {
                    updateGarage(d => {
                      d.prefs.fuelDiscounts = Object.fromEntries(
                        BRANDS.filter(b => num(disc[b]) > 0).map(b => [b, Math.min(100, num(disc[b]))]));
                    });
                    toast("Discounts saved.");
                  }}>Save discounts</button>
        )}
      </Panel>

      <Panel title="Cheapest RON 95 for you"
             note={g.prefs.pumpPrices?.updated ? `prices from ${dmy(g.prefs.pumpPrices.updated)}` : "no prices yet"}>
        {ranked.length > 0 && (
          <ul className="mb-3">
            {ranked.map((r, i) => (
              <li key={r.b} className="py-[9px] border-b last:border-b-0" style={{ borderColor: "var(--rule-2)" }}>
                <div className="flex justify-between items-baseline gap-[10px]">
                  <span className="split__k">{i === 0 ? "▸ " : ""}{r.b}</span>
                  <span className="split__v">
                    ${r.net.toFixed(3)}/L
                    <small>{r.pct > 0 ? `pump $${r.pump.toFixed(2)} − ${r.pct}%` : "no discount"}</small>
                  </span>
                </div>
                {tank > 0 && (
                  <span className="field__h !mt-[2px] block">
                    A full {tank} L tank: {money(afterDiscount(r.pump * tank, r.pct))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="field__h !mt-0 mb-2">
          Pump price per litre, as shown on the sign. There is no official live feed of Singapore
          pump prices, so these are the figures you enter — update them when prices move.
        </p>
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-2">
          {BRANDS.map(b => (
            <div key={b}>
              <label className="mini__l">{b} $/L</label>
              <input className="inp inp--sm" inputMode="decimal" placeholder="—" value={price[b]}
                     onChange={e => setPrice({ ...price, [b]: e.target.value })} />
            </div>
          ))}
        </div>
        {draftPrice !== savedPrice && (
          <button className="btn btn--sm w-full mt-3"
                  onClick={() => {
                    updateGarage(d => {
                      d.prefs.pumpPrices = {
                        updated: todayISO(),
                        ron95: Object.fromEntries(BRANDS.filter(b => num(price[b]) > 0).map(b => [b, num(price[b])])),
                      };
                    });
                    toast("Prices saved.");
                  }}>Save prices</button>
        )}
      </Panel>
    </>
  );
}
