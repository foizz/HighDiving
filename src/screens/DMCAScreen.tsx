/**
 * DMCA / Copyright Policy
 *
 * [BUSINESS INPUT REQUIRED] - This page requires customization with:
 * - Designated DMCA Agent name and contact info
 * - Copyright Office registration information (if applicable)
 * - Company legal address
 *
 * 17 U.S.C. § 512(c)(2) requires a designated DMCA agent for services hosting user content.
 */

export function DMCAScreen() {
  return (
    <div className="max-w-2xl space-y-4 py-6 px-4 text-sm">
      <h1 className="text-2xl font-bold">Copyright / DMCA Policy</h1>

      <section>
        <h2 className="text-lg font-bold mb-2">1. Copyright Respect</h2>
        <p className="text-muted">
          [COMPANY NAME] respects intellectual property rights and complies with the Digital Millennium
          Copyright Act (DMCA), 17 U.S.C. § 512. We remove infringing content upon proper notice.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2. What We Store</h2>
        <p className="text-muted">
          Users can create personal dive lists and authorized admins can upload competition results
          including diver names and performance data. Competition results are displayed in public
          rankings and may be considered user-generated content for DMCA purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3. Reporting Copyright Infringement</h2>
        <p className="text-muted mb-2">
          If you believe content on High Dive List infringes your copyright, you may submit a formal
          notice to our Designated DMCA Agent:
        </p>

        <div className="bg-surface/60 rounded-lg p-3 my-3 border border-border/40">
          <p className="font-semibold mb-2">Designated DMCA Agent:</p>
          <p className="text-muted">
            Name: [BUSINESS INPUT REQUIRED]
            <br />
            Address: [BUSINESS INPUT REQUIRED]
            <br />
            Email: [BUSINESS INPUT REQUIRED]
            <br />
            Phone: [BUSINESS INPUT REQUIRED]
          </p>
        </div>

        <p className="text-muted">
          <strong>Note:</strong> We have not registered with the U.S. Copyright Office. Registration is
          recommended. [LEGAL REVIEW REQUIRED]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4. What to Include in Your Notice</h2>
        <p className="text-muted mb-2">
          Your notice must include (17 U.S.C. § 512(c)(3)):
        </p>
        <ol className="list-decimal list-inside space-y-2 text-muted">
          <li>A physical or electronic signature of the copyright owner or authorized representative</li>
          <li>Identification of the copyrighted work claimed to be infringed</li>
          <li>Identification of the infringing material and its location on the Service</li>
          <li>Your name, address, phone number, and email</li>
          <li>
            A statement that you have a good-faith belief the material's use is not authorized by the
            copyright owner
          </li>
          <li>
            A statement under penalty of perjury that the information is accurate and you are authorized
            to act on behalf of the copyright owner
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">5. Our Response to Notices</h2>
        <p className="text-muted">
          Upon receipt of a valid DMCA notice, we will:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted mt-2">
          <li>Promptly remove or disable access to the infringing content</li>
          <li>Notify the content uploader of the takedown</li>
          <li>Preserve evidence for potential legal proceedings</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">6. Counter-Notice</h2>
        <p className="text-muted mb-2">
          If content was removed in error, you may submit a counter-notice (17 U.S.C. § 512(g)):
        </p>
        <p className="text-muted">
          Your counter-notice must include:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-muted mt-2">
          <li>Your physical or electronic signature</li>
          <li>Identification of the removed content and where it appeared</li>
          <li>A statement under penalty of perjury that removal was in error</li>
          <li>Your name, address, phone, and email</li>
          <li>A statement consenting to jurisdiction in federal court</li>
        </ol>
        <p className="text-muted mt-2">
          Send counter-notices to our DMCA Agent at the address above. We will restore the content after
          10 business days unless the copyright holder files suit.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">7. Repeat Infringer Policy</h2>
        <p className="text-muted">
          Users who repeatedly submit infringing content will have their accounts terminated.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">8. No Automatic Liability Waiver</h2>
        <p className="text-muted">
          Proper compliance with DMCA procedures does not automatically shield us from liability. A court
          may find us liable if we have actual knowledge of infringement or are aware of facts that make
          infringement obvious. [LEGAL REVIEW REQUIRED]
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">9. Changes to This Policy</h2>
        <p className="text-muted">
          We may update this DMCA Policy as needed. Continued use of the Service constitutes acceptance.
        </p>
      </section>

      <p className="text-xs text-muted mt-8 pt-4 border-t border-border/30">
        Last reviewed: [DATE]. This is a template. Consult with legal counsel before publishing.
      </p>
    </div>
  );
}
