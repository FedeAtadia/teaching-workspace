// CAL-3: Argentina's national holidays (feriados nacionales and días no
// laborables con fines turísticos), by school year. Data, not rules: the
// movable ones and the bridge days are set each year by decree, so a year is
// only added once its decree is out.
//
// 2026 was taken on 2026-10-19 from api.argentinadatos.com/v1/feriados/2026,
// which follows the official list (argentina.gob.ar/interior/feriados).

export type NationalHoliday = { date: string; name: string };

const BRIDGE = "Día no laborable con fines turísticos";

const HOLIDAYS: Record<number, NationalHoliday[]> = {
  2026: [
    { date: "2026-01-01", name: "Año Nuevo" },
    { date: "2026-02-16", name: "Carnaval" },
    { date: "2026-02-17", name: "Carnaval" },
    { date: "2026-03-23", name: BRIDGE },
    { date: "2026-03-24", name: "Día Nacional de la Memoria por la Verdad y la Justicia" },
    { date: "2026-04-02", name: "Día del Veterano y de los Caídos en la Guerra de Malvinas" },
    { date: "2026-04-03", name: "Viernes Santo" },
    { date: "2026-05-01", name: "Día del Trabajador" },
    { date: "2026-05-25", name: "Día de la Revolución de Mayo" },
    { date: "2026-06-15", name: "Paso a la Inmortalidad del General Martín Güemes" },
    { date: "2026-06-20", name: "Paso a la Inmortalidad del General Manuel Belgrano" },
    { date: "2026-07-09", name: "Día de la Independencia" },
    { date: "2026-07-10", name: BRIDGE },
    { date: "2026-08-17", name: "Paso a la Inmortalidad del General José de San Martín" },
    { date: "2026-10-12", name: "Día del Respeto a la Diversidad Cultural" },
    { date: "2026-11-09", name: "Visita del papa León XIV" },
    { date: "2026-11-23", name: "Día de la Soberanía Nacional" },
    { date: "2026-12-07", name: BRIDGE },
    { date: "2026-12-08", name: "Día de la Inmaculada Concepción de María" },
    { date: "2026-12-25", name: "Navidad" },
  ],
};

/** CAL-3: the year's national holidays in date order, or null for a year the app has no list for. */
export function nationalHolidays(year: number): NationalHoliday[] | null {
  return HOLIDAYS[year] ?? null;
}
