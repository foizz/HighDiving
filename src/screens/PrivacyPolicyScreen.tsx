/**
 * Privacy Policy
 *
 * [BUSINESS INPUT REQUIRED] - This is a template that requires customization with:
 * - Actual company/operator name and contact information
 * - Specific data retention policies
 * - Details about any third-party processors
 * - Data subject rights procedures
 *
 * This template covers the data currently collected by the application.
 * Consult with legal counsel before publishing.
 */

export function PrivacyPolicyScreen() {
  return (
    <div className="max-w-2xl space-y-4 py-6 px-4 text-sm">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>

      <div>
        <p className="text-xs text-muted mb-1 uppercase tracking-wide font-semibold">Last Updated</p>
        <p>[BUSINESS INPUT REQUIRED: Update date]</p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2">1. Introduction</h2>
        <p className="text-muted">
          [BUSINESS INPUT REQUIRED: Company name] ("we," "us," "our," or "Company") operates the High
          Dive List application ("Service"). This Privacy Policy explains how we collect, use, disclose,
          and safeguard personal information when you use our Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2. Information We Collect</h2>

        <h3 className="font-semibold mt-3">2.1 Account Information</h3>
        <p className="text-muted">
          When you create an account, we collect your email address and password. Passwords are hashed
          and never stored in plaintext. You may optionally continue as a guest without creating an
          account.
        </p>

        <h3 className="font-semibold mt-3">2.2 Dive Lists and Competition Data</h3>
        <p className="text-muted">
          We store dive lists you create (list names, selected dives, rule set preferences, gender
          settings) and conversation history from the Ask feature. This data is associated with your
          account and stored in our database.
        </p>

        <h3 className="font-semibold mt-3">2.3 Admin/Competition Results</h3>
        <p className="text-muted">
          Authorized admins may upload competition results, including diver names, rankings, and scores.
          This data becomes part of the public rankings accessible to all signed-in users.
        </p>

        <h3 className="font-semibold mt-3">2.4 Automatically Collected Information</h3>
        <p className="text-muted">
          We automatically receive information from your device, including IP address (from Supabase
          logs), browser type, operating system, and usage data. We use Supabase as our backend
          service provider, which implements standard security logging.
        </p>

        <h3 className="font-semibold mt-3">2.5 AI Assistant Usage</h3>
        <p className="text-muted">
          When using the Ask feature, we track the number of requests per user per day to enforce fair
          usage limits. Requests are sent to OpenAI's API (separate Privacy Policy applies).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1 text-muted">
          <li>Provide and improve the Service</li>
          <li>Authenticate users and secure accounts</li>
          <li>Store and retrieve your dive lists and competition data</li>
          <li>Power the Ask AI assistant (queries sent to OpenAI)</li>
          <li>Enforce usage limits on the assistant</li>
          <li>Send password reset and account confirmation emails</li>
          <li>Detect and prevent fraud and abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4. Third-Party Service Providers</h2>
        <p className="text-muted mb-2">We use the following third-party services:</p>
        <ul className="space-y-2 text-muted">
          <li>
            <strong>Supabase:</strong> Database, authentication, and backend hosting. See their Privacy
            Policy at https://supabase.com/privacy
          </li>
          <li>
            <strong>OpenAI:</strong> Powers the Ask assistant. Requests include competition data and rules
            text. See their Privacy Policy at https://openai.com/privacy
          </li>
          <li>
            <strong>Google Analytics:</strong> Usage analytics, only if you allow it (see Section
            10). See Google's Privacy Policy at https://policies.google.com/privacy
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">5. Data Retention</h2>
        <p className="text-muted">
          [BUSINESS INPUT REQUIRED] Your account information, dive lists, and competition results are
          retained as long as your account is active. When you delete your account, all personal data
          associated with it is deleted from our systems (see Section 8).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">6. Data Transfers and Jurisdiction</h2>
        <p className="text-muted">
          Our backend (Supabase) and AI services (OpenAI) are located in the United States, and Google Analytics (if you
          allow it) processes data in the United States and elsewhere. By using the
          Service, you consent to the transfer of your information to the United States, where data
          protection laws may differ from your home country. If this is unacceptable, do not use the
          Service.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">7. Your Privacy Rights</h2>

        <h3 className="font-semibold mt-3">7.1 Access and Portability</h3>
        <p className="text-muted">
          You have the right to access your personal data and request a copy of your account information
          and dive lists in a portable format.
        </p>

        <h3 className="font-semibold mt-3">7.2 Correction and Deletion</h3>
        <p className="text-muted">
          You may update your email address or password in Settings. You may delete your account at any
          time (see below).
        </p>

        <h3 className="font-semibold mt-3">7.3 EU / UK / Canadian Residents</h3>
        <p className="text-muted">
          If you are located in the EU, UK, or Canada, you have additional rights including the right to
          object to processing and the right to lodge a complaint with your data protection authority.
          [CONTACT INFO REQUIRED]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">8. Account Deletion</h2>
        <p className="text-muted">
          To delete your account and all associated data, go to Settings → Account and select "Delete
          Account." This action is irreversible. After deletion:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted mt-2">
          <li>Your account and login credentials are immediately removed</li>
          <li>Your dive lists are permanently deleted</li>
          <li>Your conversation history is permanently deleted</li>
          <li>Admin records are removed (if applicable)</li>
          <li>Public competition results you entered remain for historical accuracy</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">9. Security</h2>
        <p className="text-muted">
          We implement industry-standard security measures to protect your information. Passwords are
          hashed using bcrypt. API communications use HTTPS. Sensitive data (API keys, secrets) are
          stored separately from the application code.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">10. Cookies and Tracking</h2>
        <p className="text-muted">
          We use Supabase's authentication session to keep you signed in. This is necessary for
          the Service to work and cannot be turned off.
        </p>
        <p className="text-muted mt-2">
          If you allow it, we also use Google Analytics to understand which screens are used. It
          sets cookies (named _ga and _ga_*) and sends your IP address, device and browser details,
          and the pages you visit to Google. It stays off until you choose to allow it, and it
          stays off if your browser sends a Global Privacy Control signal. You can change your
          choice at any time in Settings. We have turned off Google signals and ad
          personalization. We do not use advertising cookies or session replay tools.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">11. Children's Privacy</h2>
        <p className="text-muted">
          The Service is not directed to children under 13. We do not knowingly collect personal
          information from children under 13. If we learn we have collected such information, we will
          delete it immediately.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">12. Changes to This Policy</h2>
        <p className="text-muted">
          We may update this Privacy Policy periodically. Significant changes will be notified via email
          or a prominent notice on the Service. Your continued use constitutes acceptance.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">13. Contact Us</h2>
        <p className="text-muted">
          For privacy questions or to exercise your rights:
        </p>
        <p className="text-muted mt-2">
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
