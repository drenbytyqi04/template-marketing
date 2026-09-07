import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePrefersReducedMotion } from "@/components/marketing/usePrefersReducedMotion";
import { submitContactRequestFn } from "@/lib/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Book a demo with krijo24" },
      {
        name: "description",
        content:
          "Tell us about your business and we will get in touch to show you krijo24 and talk through pricing.",
      },
      { property: "og:title", content: "Book a demo with krijo24" },
      {
        property: "og:description",
        content: "Tell us about your business and we will get in touch.",
      },
      { property: "og:url", content: "https://krijo24.com/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://krijo24.com/contact" }],
  }),
  component: ContactPage,
});

const CONTACT_EMAIL = "contact@webdoagency.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [emailed, setEmailed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [message, setMessage] = useState("");
  const reduced = usePrefersReducedMotion();
  const submitRequest = useServerFn(submitContactRequestFn);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || sent) return;
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const res = await submitRequest({
        data: {
          name: name.trim(),
          email: email.trim(),
          business: business.trim(),
          message: message.trim(),
        },
      });
      if (!res.saved) {
        setError("We could not send your request. Please try again, or email us directly.");
        return;
      }
      setSent(true);
      setEmailed(res.emailed);
      toast.success(
        res.emailed
          ? "Request sent. We will be in touch."
          : "Request saved. Email delivery is delayed — you can also write to us directly.",
      );
    } catch {
      setError("We could not send your request. Please try again, or email us directly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Book a demo
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Tell us a little about your business. We read every request and reply personally,
            usually within a day.
          </p>
        </motion.div>

        <div className="mt-10">
          {sent ? (
            <motion.div
              className="flex flex-col items-start gap-3 border-t border-border pt-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="font-display text-xl font-bold">Thanks, we have it</h2>
              <p className="text-sm text-muted-foreground">
                {emailed
                  ? `Your request is with us. We will reply to ${email.trim()} shortly.`
                  : `Your request is saved, but our email notification did not go through. To be safe, also write to ${CONTACT_EMAIL}.`}
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Add something? Write to {CONTACT_EMAIL}
              </a>
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 border-t border-border pt-8"
            >
              <div>
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 rounded-xl"
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 rounded-xl"
                  placeholder="you@business.com"
                />
              </div>
              <div>
                <Label htmlFor="contact-business">Business</Label>
                <Input
                  id="contact-business"
                  maxLength={120}
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className="mt-2 rounded-xl"
                  placeholder="Business name"
                />
              </div>
              <div>
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-2 rounded-xl"
                  rows={4}
                  placeholder="What would you like to see in the demo?"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" size="lg" disabled={busy} className="mt-2 rounded-full">
                {busy ? "Sending..." : "Send request"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Prefer email directly? Write to{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}
