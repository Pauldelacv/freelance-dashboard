import { describe, expect, it } from "vitest";
import { groupAwaitingInvoices, type InvoicedDay } from "@/lib/calculations/invoices";

const nord = { name: "Agence Nord", color: "#2a78d6", paymentTerms: 30 };
const kappa = { name: "Studio Kappa", color: "#e0622f", paymentTerms: 45 };

function day(partial: Partial<InvoicedDay> & { date: string }): InvoicedDay {
  return {
    fraction: 1,
    rate: 50000,
    type: "billable",
    billing: "invoiced",
    clientId: "nord",
    billedAt: null,
    client: nord,
    ...partial,
  };
}

describe("factures en attente d'encaissement", () => {
  it("regroupe les jours par client et par mois", () => {
    const invoices = groupAwaitingInvoices(
      [
        day({ date: "2026-08-03" }),
        day({ date: "2026-08-04", fraction: 0.5 }),
        day({ date: "2026-09-01" }),
        day({ date: "2026-08-05", clientId: "kappa", client: kappa, rate: 65000 }),
      ],
      "2026-09-15",
    );

    expect(invoices).toHaveLength(3);
    const [aout] = invoices;
    expect(aout.clientName).toBe("Agence Nord");
    expect(aout.month).toBe("2026-08");
    expect(aout.days).toBe(1.5);
    expect(aout.amount).toBe(75000);
    expect(invoices.map((invoice) => invoice.key)).toEqual([
      "nord|2026-08",
      "kappa|2026-08",
      "nord|2026-09",
    ]);
  });

  it("date l'échéance avec le délai du client et la facture la plus ancienne", () => {
    const [invoice] = groupAwaitingInvoices(
      [
        day({ date: "2026-08-20", billedAt: "2026-08-31" }),
        day({ date: "2026-08-03", billedAt: "2026-08-10" }),
      ],
      "2026-08-15",
    );

    expect(invoice.billedAt).toBe("2026-08-10");
    expect(invoice.dueAt).toBe("2026-09-09");
    expect(invoice.late).toBe(false);
  });

  it("signale un paiement en retard", () => {
    const [invoice] = groupAwaitingInvoices(
      [day({ date: "2026-06-02", billedAt: "2026-06-30" })],
      "2026-08-29",
    );

    expect(invoice.dueAt).toBe("2026-07-30");
    expect(invoice.late).toBe(true);
  });

  it("laisse l'échéance vide quand la date de facture manque", () => {
    const [invoice] = groupAwaitingInvoices([day({ date: "2026-08-03" })], "2026-08-29");

    expect(invoice.dueAt).toBeNull();
    expect(invoice.late).toBe(false);
  });

  it("garde les jours sans client dans un lot à part", () => {
    const [invoice] = groupAwaitingInvoices(
      [day({ date: "2026-08-03", clientId: null, client: null })],
      "2026-08-29",
    );

    expect(invoice.key).toBe("|2026-08");
    expect(invoice.clientId).toBeNull();
    expect(invoice.clientName).toBe("Sans client");
    expect(invoice.color).toBeNull();
  });

  it("ignore les jours non facturables, qui ne portent aucun montant", () => {
    expect(
      groupAwaitingInvoices([day({ date: "2026-08-03", type: "internal" })], "2026-08-29"),
    ).toEqual([]);
  });
});
