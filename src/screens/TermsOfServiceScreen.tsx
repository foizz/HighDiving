/**
 * Terms of Service
 *
 * [BUSINESS INPUT REQUIRED] - This is a template that requires customization with:
 * - Actual company/operator name
 * - Governing law and jurisdiction
 * - Dispute resolution procedures
 * - Warranty disclaimers
 * - Limitation of liability amounts
 *
 * Consult with legal counsel before publishing.
 */

export function TermsOfServiceScreen() {
  return (
    <div className="max-w-2xl space-y-4 py-6 px-4 text-sm">
      <h1 className="text-2xl font-bold">Terms of Service</h1>

      <div>
        <p className="text-xs text-muted mb-1 uppercase tracking-wide font-semibold">Effective Date</p>
        <p>[BUSINESS INPUT REQUIRED: Effective date]</p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2">1. Acceptance of Terms</h2>
        <p className="text-muted">
          By accessing and using High Dive List ("Service"), you agree to be bound by these Terms of
          Service ("Terms"). If you disagree with any part, you may not use the Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2. Service Description</h2>
        <p className="text-muted">
          High Dive List is a web application for high diving enthusiasts to build competition dive
          lists, verify compliance with competition rules (Red Bull Cliff Diving or World Aquatics),
          simulate scoring outcomes, and view competition rankings.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3. User Accounts</h2>

        <h3 className="font-semibold mt-3">3.1 Account Registration</h3>
        <p className="text-muted">
          You may use the Service as a guest (lists stored locally on your device) or create an account
          by providing a valid email and password. You are responsible for maintaining the
          confidentiality of your account credentials.
        </p>

        <h3 className="font-semibold mt-3">3.2 Account Responsibility</h3>
        <p className="text-muted">
          You are responsible for all activities under your account. You agree to notify us immediately
          of any unauthorized access or use.
        </p>

        <h3 className="font-semibold mt-3">3.3 Account Termination</h3>
        <p className="text-muted">
          You may delete your account at any time in Settings → Account. We may terminate your account
          if you violate these Terms or engage in harmful conduct.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4. Acceptable Use</h2>
        <p className="text-muted mb-2">You agree not to:</p>
        <ul className="list-disc list-inside space-y-1 text-muted">
          <li>Violate any applicable law or regulation</li>
          <li>Infringe on intellectual property rights</li>
          <li>Upload malware, spam, or harmful content</li>
          <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
          <li>Use the Service to harass, threaten, or intimidate others</li>
          <li>Interfere with or disrupt the Service's operation</li>
          <li>Submit false or misleading competition results as an admin</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">5. User-Generated Content</h2>

        <h3 className="font-semibold mt-3">5.1 Your Content</h3>
        <p className="text-muted">
          Dive lists you create remain your property. Competition results uploaded by authorized admins
          (diver names, scores, rankings) become part of the public rankings.
        </p>

        <h3 className="font-semibold mt-3">5.2 License Grant</h3>
        <p className="text-muted">
          By uploading competition results, you represent that you own or have permission to share that
          information, and you grant us a non-exclusive, worldwide license to display it in rankings and
          search results.
        </p>

        <h3 className="font-semibold mt-3">5.3 Copyright Compliance</h3>
        <p className="text-muted">
          We respect intellectual property rights. If you believe content on the Service infringes your
          copyright, see our DMCA Policy [LINK].
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">6. Intellectual Property</h2>
        <p className="text-muted">
          The Service, including its code, design, and content (except user-uploaded competition
          results), is owned by [COMPANY NAME] or its licensors. The DD tables in the app are derived
          from published Red Bull and World Aquatics rule books and are used for informational purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">7. Third-Party Services</h2>
        <p className="text-muted">
          The Service uses Supabase (database) and OpenAI (AI assistant). Your use is also subject to
          their terms of service and privacy policies:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted mt-2">
          <li>Supabase: https://supabase.com/terms</li>
          <li>OpenAI: https://openai.com/terms</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">8. Limitations of Liability</h2>
        <p className="text-muted mb-2">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted">
          <li>
            The Service is provided "as is" without warranties of any kind, express or implied.
          </li>
          <li>
            We are not liable for indirect, incidental, special, consequential, or punitive damages,
            even if advised of the possibility.
          </li>
          <li>
            Our total liability is limited to the amount you paid us (if any) in the past 12 months.
          </li>
          <li>
            Some jurisdictions do not allow liability limitations; these clauses may not apply to you.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">9. Disclaimer</h2>
        <p className="text-muted">
          The DD tables and rules interpretations provided by the Service are derived from published rule
          books and are intended for informational purposes only. They do not replace the official rule
          books published by Red Bull Cliff Diving or World Aquatics (FINA). For official rulings, consult
          the published rule books or competition officials.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">10. Subscriptions and Auto-Renewal</h2>
        <p className="text-muted">
          The Service does not currently offer paid subscriptions. If subscription features are added in
          the future, separate terms will govern auto-renewal, billing, and cancellation.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">11. Termination</h2>
        <p className="text-muted">
          We may suspend or terminate your access if you violate these Terms or engage in harmful conduct.
          You may terminate by deleting your account.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">12. Modifications to Terms</h2>
        <p className="text-muted">
          We may update these Terms. Significant changes will be notified via email or prominent notice.
          Your continued use constitutes acceptance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">13. Governing Law and Dispute Resolution</h2>
        <p className="text-muted">
          [BUSINESS INPUT REQUIRED]
          <br />
          <br />
          These Terms are governed by the laws of [JURISDICTION], without regard to conflict of laws
          principles. Disputes shall be resolved under [DISPUTE RESOLUTION PROCESS: Arbitration / Litigation
          / Mediation].
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">14. Severability</h2>
        <p className="text-muted">
          If any provision of these Terms is found to be invalid, that provision is severed and the
          remaining provisions remain in effect.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">15. Contact</h2>
        <p className="text-muted">
          For questions about these Terms:
          <br />
          <br />
          [BUSINESS INPUT REQUIRED]
          <br />
          Email: [contact email]
          <br />
          Mail: [company address]
        </p>
      </section>

      <p className="text-xs text-muted mt-8 pt-4 border-t border-border/30">
        Last reviewed: [DATE]. This is a template. Consult with legal counsel before publishing.
      </p>
    </div>
  );
}
