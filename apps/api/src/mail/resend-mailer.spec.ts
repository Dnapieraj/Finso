import { ResendMailer } from "./resend-mailer.js";

const message = { to: "ola@example.com", subject: "Temat", text: "Treść" };

describe("ResendMailer", () => {
  it("wysyła wiadomość przez API Resend z kluczem i nadawcą", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    const mailer = new ResendMailer({ apiKey: "re_123", from: "Finso <kontakt@finso.app>", fetch });

    await mailer.send(message);

    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer re_123", "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Finso <kontakt@finso.app>",
        to: ["ola@example.com"],
        subject: "Temat",
        text: "Treść",
      }),
    });
  });

  it("odpowiedź inna niż 2xx to błąd — wywołujący decyduje, co z nim zrobić", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 422 })));
    const mailer = new ResendMailer({ apiKey: "re_123", from: "a@b.c", fetch });

    await expect(mailer.send(message)).rejects.toThrow("Resend responded 422");
  });
});
