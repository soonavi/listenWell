import { useEffect, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import { X, Shield, ScrollText } from 'lucide-react'

// ---------------------------------------------------------------------------
// Centralised, easy-to-edit details used throughout both documents.
// NOTE FOR THE OPERATOR: fill in CONTACT_EMAIL and GOVERNING_LAW with your real
// values before relying on these documents. They are placeholders.
// ---------------------------------------------------------------------------
const LEGAL_INFO = {
  siteName: 'ListenWell',
  operator: 'ListenWell',
  contactEmail: 'support@listenwell.app',
  governingLaw: 'the State of Delaware, United States',
  effectiveDate: 'June 14, 2026',
  uploadLimit: 50,
}

const UPDATED = LEGAL_INFO.effectiveDate

function H({ children }) {
  return <h3 className="text-sm font-semibold text-cyan-200 tracking-wide mt-6 mb-2 first:mt-0">{children}</h3>
}

function P({ children, className = '' }) {
  return <p className={`text-[13px] leading-relaxed text-gray-300 mb-3 ${className}`}>{children}</p>
}

function LI({ children }) {
  return <li className="text-[13px] leading-relaxed text-gray-300 mb-1.5">{children}</li>
}

function PrivacyPolicy() {
  return (
    <div>
      <P>
        This Privacy Policy explains how {LEGAL_INFO.operator} (&ldquo;{LEGAL_INFO.siteName},&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, stores, and discloses information when you use the
        {' '}{LEGAL_INFO.siteName} website and application (the &ldquo;Service&rdquo;). By creating an account or using the
        Service, you agree to the practices described in this Policy. If you do not agree, do not use the Service.
      </P>
      <P className="text-gray-500"><span className="text-gray-500">Last updated: {UPDATED}</span></P>

      <H>1. Who We Are</H>
      <P>
        {LEGAL_INFO.siteName} is a personal music-library application that lets you upload audio files you own and play
        them back from any device. We act as the data controller for the limited personal information described below.
      </P>

      <H>2. Information We Collect</H>
      <P>We collect only what is needed to operate the Service:</P>
      <ul className="list-disc pl-5 mb-3">
        <LI><span className="text-gray-100 font-medium">Account information.</span> The email address and password you provide at sign-up. Passwords are handled and stored by our authentication provider in hashed form; we never see or store your plain-text password.</LI>
        <LI><span className="text-gray-100 font-medium">Content you upload.</span> The audio files, cover images, and metadata (titles, artists, albums, descriptions, lyrics) you add to your library.</LI>
        <LI><span className="text-gray-100 font-medium">Library and preference data.</span> Playlists, loved songs, play counts, listening history, recently played items, and your settings (theme, equalizer, playback options, profile picture, display name, and similar).</LI>
        <LI><span className="text-gray-100 font-medium">Technical data.</span> Standard information your browser and our hosting and infrastructure providers generate automatically, such as IP address, device and browser type, and timestamps, primarily for security, abuse prevention, and reliability.</LI>
        <LI><span className="text-gray-100 font-medium">Local storage.</span> We store a cache of your library and settings in your browser&rsquo;s local storage so the app loads quickly and works offline.</LI>
      </ul>
      <P>
        We do <span className="text-gray-100 font-medium">not</span> intentionally collect special categories of data,
        and we do not build advertising profiles or sell your personal information.
      </P>

      <H>3. How We Use Information</H>
      <ul className="list-disc pl-5 mb-3">
        <LI>To create and maintain your account and authenticate you.</LI>
        <LI>To store your uploaded files and sync your library and settings across your devices.</LI>
        <LI>To operate, maintain, secure, and improve the Service.</LI>
        <LI>To enforce our Terms &amp; Conditions, prevent abuse, and comply with legal obligations.</LI>
        <LI>To communicate with you about your account or important changes to the Service.</LI>
      </ul>

      <H>4. How Information Is Stored and Shared</H>
      <P>
        Your files and data are stored using third-party cloud infrastructure providers (including our backend and
        storage provider, Supabase, and its underlying hosting providers). These providers process data on our behalf
        under their own security and privacy terms. Your uploaded audio files are kept in a private storage area and are
        accessed through time-limited links scoped to your account.
      </P>
      <P>We share information only in the following limited circumstances:</P>
      <ul className="list-disc pl-5 mb-3">
        <LI><span className="text-gray-100 font-medium">Service providers</span> who help us run the Service (hosting, storage, authentication), bound to process data only as needed.</LI>
        <LI><span className="text-gray-100 font-medium">Legal and safety</span> reasons, where we believe disclosure is required by law or necessary to protect rights, property, or safety.</LI>
        <LI><span className="text-gray-100 font-medium">Business transfers</span>, if the Service is involved in a merger, acquisition, or sale of assets.</LI>
      </ul>
      <P>We do not sell, rent, or trade your personal information to third parties for their marketing.</P>

      <H>5. Cookies and Local Storage</H>
      <P>
        We use only the cookies and browser storage necessary to keep you signed in and to cache your library and
        preferences. We do not use third-party advertising or cross-site tracking cookies. You can clear this data
        through your browser settings, though doing so may sign you out and remove the local cache.
      </P>

      <H>6. Data Retention</H>
      <P>
        We retain your account and library data for as long as your account is active. When you delete a song it is
        removed from your library and queued for deletion from storage. If you delete your account or ask us to delete
        your data, we will delete or anonymize your personal information within a reasonable period, except where we must
        retain it to comply with legal obligations, resolve disputes, or enforce our agreements.
      </P>

      <H>7. Security</H>
      <P>
        We use reasonable technical and organizational measures, including access controls and encryption in transit, to
        protect your information. However, no method of transmission or storage is completely secure, and we cannot
        guarantee absolute security. You are responsible for keeping your password confidential and for maintaining your
        own backups of any files you consider important.
      </P>

      <H>8. Your Rights and Choices</H>
      <P>
        Depending on where you live, you may have rights to access, correct, export, or delete your personal
        information, and to object to or restrict certain processing. You can access and edit most of your data directly
        in the app, and you may contact us at {LEGAL_INFO.contactEmail} to exercise any of these rights. We will respond
        consistent with applicable law.
      </P>

      <H>9. Children&rsquo;s Privacy</H>
      <P>
        The Service is not directed to children under 13 (or the minimum age required in your jurisdiction), and we do
        not knowingly collect their personal information. If you believe a child has provided us information, contact us
        and we will delete it.
      </P>

      <H>10. International Users</H>
      <P>
        Your information may be processed and stored in countries other than your own, including the United States, which
        may have different data-protection laws. By using the Service you consent to this transfer and processing.
      </P>

      <H>11. Changes to This Policy</H>
      <P>
        We may update this Privacy Policy from time to time. When we do, we will revise the &ldquo;Last updated&rdquo;
        date above and, where appropriate, provide additional notice. Your continued use of the Service after changes
        take effect constitutes acceptance of the updated Policy.
      </P>

      <H>12. Contact</H>
      <P>
        Questions about this Policy or your data can be sent to {LEGAL_INFO.contactEmail}.
      </P>
    </div>
  )
}

function TermsAndConditions() {
  return (
    <div>
      <P>
        These Terms &amp; Conditions (the &ldquo;Terms&rdquo;) are a binding agreement between you and
        {' '}{LEGAL_INFO.operator} (&ldquo;{LEGAL_INFO.siteName},&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) governing your use of the {LEGAL_INFO.siteName} website and application (the
        &ldquo;Service&rdquo;). <span className="text-gray-100 font-medium">By accessing or using the Service, you accept
        these Terms in full. If you do not agree, you must not use the Service.</span>
      </P>
      <P className="text-gray-500"><span className="text-gray-500">Last updated: {UPDATED}</span></P>

      <H>1. Eligibility</H>
      <P>
        You must be at least 13 years old (or the minimum legal age in your jurisdiction) and able to form a binding
        contract to use the Service. By using the Service you represent and warrant that you meet these requirements.
      </P>

      <H>2. The Service</H>
      <P>
        {LEGAL_INFO.siteName} is a personal tool for storing and playing back audio files that you lawfully own or are
        otherwise authorized to use. The Service is provided for your personal, non-commercial use only.
      </P>

      <H>3. Your Account</H>
      <P>
        You are responsible for all activity that occurs under your account and for keeping your login credentials
        secure. You agree to provide accurate information and to notify us promptly of any unauthorized use. We are not
        liable for any loss arising from unauthorized use of your account.
      </P>

      <H>4. Your Content and Responsibility for It</H>
      <P>
        You retain ownership of the files, images, and metadata you upload (&ldquo;Your Content&rdquo;). You grant us a
        limited, non-exclusive license to host, store, process, and transmit Your Content solely to provide the Service
        to you.
      </P>
      <P>
        <span className="text-gray-100 font-medium">You are solely and entirely responsible for Your Content.</span> You
        represent and warrant that you own or have all necessary rights, licenses, and permissions to upload, store, and
        play Your Content, and that doing so does not and will not infringe or violate the intellectual-property,
        privacy, or other rights of any person or any law. You assume all risk and all liability associated with Your
        Content.
      </P>

      <H>5. Acceptable Use</H>
      <P>You agree that you will not, and will not attempt to:</P>
      <ul className="list-disc pl-5 mb-3">
        <LI>upload, store, or distribute any content you do not have the legal right to use, or that infringes any copyright or other right;</LI>
        <LI>use the Service for piracy, unauthorized distribution, or any unlawful purpose;</LI>
        <LI>share, resell, or publicly distribute content through the Service or use it as a public file host;</LI>
        <LI>upload malware or attempt to disrupt, overload, reverse-engineer, or gain unauthorized access to the Service or its infrastructure;</LI>
        <LI>circumvent usage limits, security measures, or access controls; or</LI>
        <LI>use the Service in any way that could expose us to legal liability.</LI>
      </ul>
      <P>
        We may, but are not obligated to, monitor, remove, or disable access to content or accounts that we believe
        violate these Terms or applicable law, at any time and without notice.
      </P>

      <H>6. Copyright and Infringement</H>
      <P>
        We respect intellectual-property rights and expect you to do the same. The Service is intended only for content
        you are authorized to use. If you believe content has been handled in a way that infringes your rights, contact
        us at {LEGAL_INFO.contactEmail} with sufficient detail to identify the material, and we will respond
        appropriately, which may include removing content and terminating repeat infringers&rsquo; accounts.
      </P>

      <H>7. Usage Limits and Changes to the Service</H>
      <P>
        The Service is currently provided with a limit of {LEGAL_INFO.uploadLimit} uploaded songs per account. We may
        change, introduce, raise, lower, meter, or charge for usage limits and features at any time, and we may add paid
        plans in the future. We may modify, suspend, or discontinue all or part of the Service at any time, with or
        without notice, without liability to you.
      </P>

      <H>8. Our Intellectual Property</H>
      <P>
        The Service itself&mdash;including its software, design, branding, and content we provide&mdash;is owned by us or
        our licensors and is protected by law. These Terms grant you a limited, revocable, non-transferable license to
        use the Service; no other rights are granted.
      </P>

      <H>9. Third-Party Services</H>
      <P>
        The Service relies on third-party providers (such as hosting, storage, and authentication services). We are not
        responsible for the acts, omissions, availability, or policies of those third parties, and your use of the
        Service may also be subject to their terms.
      </P>

      <H>10. No Backup Guarantee; Assumption of Risk</H>
      <P>
        <span className="text-gray-100 font-medium">You are responsible for maintaining your own independent backups of
        any files or data you value.</span> We do not guarantee that Your Content or any data will be stored, retained,
        or available without loss, corruption, or deletion. You use the Service at your own risk and assume full
        responsibility for any loss of data or content.
      </P>

      <H>11. Disclaimer of Warranties</H>
      <P className="uppercase text-[12px] tracking-wide">
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind,
        whether express, implied, or statutory. To the fullest extent permitted by law, we disclaim all warranties,
        including any implied warranties of merchantability, fitness for a particular purpose, title, accuracy, and
        non-infringement, and any warranty that the Service will be uninterrupted, secure, error-free, or free of harmful
        components.
      </P>

      <H>12. Limitation of Liability</H>
      <P className="uppercase text-[12px] tracking-wide">
        To the fullest extent permitted by law, in no event will {LEGAL_INFO.siteName}, its operator, owners,
        contributors, or service providers be liable for any indirect, incidental, special, consequential, exemplary, or
        punitive damages, or for any loss of profits, revenue, data, goodwill, or other intangible losses, arising out of
        or relating to the Service or these Terms, whether based on warranty, contract, tort (including negligence),
        statute, or any other legal theory, even if advised of the possibility of such damages.
      </P>
      <P className="uppercase text-[12px] tracking-wide">
        To the fullest extent permitted by law, our total aggregate liability for all claims relating to the Service
        will not exceed the greater of the amount you paid us, if any, for the Service in the twelve months before the
        claim, or twenty United States dollars (US$20). Some jurisdictions do not allow certain limitations, so some of
        the above may not apply to you; in that case our liability is limited to the maximum extent permitted by law.
      </P>

      <H>13. Indemnification</H>
      <P>
        You agree to defend, indemnify, and hold harmless {LEGAL_INFO.siteName}, its operator, owners, contributors, and
        service providers from and against any and all claims, demands, damages, losses, liabilities, costs, and expenses
        (including reasonable legal fees) arising out of or related to: (a) Your Content; (b) your use of the Service;
        (c) your violation of these Terms or any law; or (d) your violation of any rights of a third party. We reserve
        the right to assume the exclusive defense of any matter subject to indemnification, and you agree to cooperate.
      </P>

      <H>14. Termination</H>
      <P>
        We may suspend or terminate your access to the Service at any time, with or without cause or notice. You may stop
        using the Service at any time. Sections that by their nature should survive termination&mdash;including content
        responsibility, disclaimers, limitation of liability, indemnification, and governing law&mdash;will survive.
      </P>

      <H>15. Governing Law and Dispute Resolution</H>
      <P>
        These Terms are governed by the laws of {LEGAL_INFO.governingLaw}, without regard to conflict-of-laws principles.
        You agree that any dispute will be resolved exclusively in the courts located in that jurisdiction, and you
        consent to their personal jurisdiction, except where binding arbitration applies as described below.
      </P>
      <P>
        <span className="text-gray-100 font-medium">Individual claims only.</span> To the extent permitted by law, you
        and we agree that any dispute will be resolved on an individual basis, and you waive any right to participate in a
        class, collective, or representative action. Any claim must be brought within one (1) year after it arises or it
        is permanently barred.
      </P>

      <H>16. Changes to These Terms</H>
      <P>
        We may update these Terms from time to time. When we do, we will revise the &ldquo;Last updated&rdquo; date
        above. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
      </P>

      <H>17. General</H>
      <P>
        If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect, and the
        unenforceable provision will be limited or removed to the minimum extent necessary. Our failure to enforce any
        provision is not a waiver. These Terms, together with the Privacy Policy, are the entire agreement between you and
        us regarding the Service and supersede any prior agreements. You may not assign these Terms; we may.
      </P>

      <H>18. Contact</H>
      <P>Questions about these Terms can be sent to {LEGAL_INFO.contactEmail}.</P>
    </div>
  )
}

export default function LegalModal({ open, initialTab = 'privacy', onClose }) {
  const [tab, setTab] = useState(initialTab)
  // Reset to the requested tab whenever the caller opens with a different one,
  // adjusting state during render (the React-recommended alternative to an
  // effect) so internal tab switches still work and the exit animation is kept.
  const [prevInitial, setPrevInitial] = useState(initialTab)
  if (initialTab !== prevInitial) {
    setPrevInitial(initialTab)
    setTab(initialTab)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tab === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
            className="w-[min(94vw,720px)] max-h-[86vh] flex flex-col rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl glass-card overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + tabs */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setTab('privacy')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tab === 'privacy' ? 'bg-violet-500/15 border border-violet-500/40 text-violet-100' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Shield className="w-3.5 h-3.5" /> Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => setTab('terms')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tab === 'terms' ? 'bg-violet-500/15 border border-violet-500/40 text-violet-100' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <ScrollText className="w-3.5 h-3.5" /> Terms &amp; Conditions
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <h2 className="text-lg font-semibold text-white mb-1">
                {tab === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </h2>
              {tab === 'privacy' ? <PrivacyPolicy /> : <TermsAndConditions />}
              <p className="text-[11px] text-gray-600 mt-6 pt-4 border-t border-white/[0.06]">
                This document is provided for general informational purposes and does not constitute legal advice.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
