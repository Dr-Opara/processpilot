import Link from "next/link";
import type { ReactNode } from "react";
export const pages = [
  "home",
  "capabilities",
  "industries",
  "contracting",
  "client-engagements",
  "insights",
  "about",
  "discuss-a-project",
  "privacy",
  "terms",
  "security",
  "contact",
] as const;
export type PageKey = (typeof pages)[number];
const nav = [
  ["Expertise", "/industries"],
  ["Who we are", "/about"],
  ["What we do", "/capabilities"],
  ["Contracts", "/contracting"],
  ["Experience", "/client-engagements"],
  ["Insights", "/insights"],
];
const caps = [
  [
    "AI Engineering",
    "Production-minded AI systems designed around real workflows, governed data, and accountable human decisions.",
    [
      "Custom AI agents",
      "Agentic and multi-agent systems",
      "RAG and enterprise copilots",
      "Knowledge assistants",
      "AI workflow automation",
      "API and tool-calling agents",
      "Human-in-the-loop AI",
      "AI evaluation and prompt engineering",
      "Enterprise AI integrations",
    ],
  ],
  [
    "Secure AI",
    "Security engineered into the AI lifecycle—from design and data access to agent behavior and oversight.",
    [
      "AI security assessments",
      "Prompt injection defense",
      "AI red teaming",
      "Data leakage controls",
      "Secure RAG",
      "AI guardrails",
      "Secure tool use",
      "AI identity and access controls",
      "NIST AI RMF",
      "Responsible AI and governance",
      "Model and agent risk assessments",
    ],
  ],
  [
    "Cybersecurity",
    "Risk-based cyber capabilities for federal, regulated, and complex commercial environments.",
    [
      "Cybersecurity assessments",
      "RMF / ATO",
      "FedRAMP readiness",
      "Cloud security",
      "Zero Trust",
      "Vulnerability management",
      "Continuous monitoring",
      "POA&M management",
      "IAM and security architecture",
      "Incident readiness",
      "Security documentation",
      "Federal cyber program support",
    ],
  ],
  [
    "Governance & Compliance",
    "Programs that translate frameworks into controls, evidence, decisions, and sustained operating discipline.",
    [
      "NIST 800-53, 800-37 and 800-207",
      "NIST AI RMF",
      "FISMA and FedRAMP",
      "CMMC readiness",
      "Risk and control assessments",
      "Audit readiness",
      "Policy development",
      "Continuous monitoring programs",
    ],
  ],
] as const;
const industries = [
  [
    "Federal & Public Sector",
    "Mission-focused AI agents, secure automation, RMF, ATO, Zero Trust, and continuous monitoring.",
  ],
  [
    "Healthcare",
    "Patient intake, care-navigation support, document processing, knowledge assistants, secure data workflows, and operational automation. Compliance depends on the final implementation.",
  ],
  [
    "Financial Services",
    "Customer-service agents, document intelligence, risk and control support, governed AI, cybersecurity, and accountable automation. Agents do not provide financial advice.",
  ],
  [
    "Real Estate",
    "Lead qualification, property inquiry, leasing support, maintenance triage, document workflows, portfolio knowledge, and operations automation.",
  ],
  [
    "Technology",
    "AI solution engineering, custom agents, cloud security, secure integrations, and scalable governance.",
  ],
  [
    "Professional Services",
    "Knowledge agents, client intake, document workflows, delivery automation, and compliance operations.",
  ],
  [
    "Regulated Enterprises",
    "Secure-by-design systems aligned to policy, evidence, human oversight, and measurable risk reduction.",
  ],
] as const;
function Brand() {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="ProcessPilot Technologies home"
    >
      <span>
        PROCESSPILOT
        <b aria-hidden="true">
          {"TECHNOLOGIES".split("").map((letter, index) => (
            <i key={`${letter}-${index}`}>{letter}</i>
          ))}
        </b>
      </span>
    </Link>
  );
}
function Header() {
  return (
    <header>
      <div className="utility">
        <span>STRATEGY. ENGINEERING. SECURITY.</span>
        <a href="mailto:info@processpilottech.com">info@processpilottech.com</a>
        <a href="tel:+13467454398">(346) 745-4398</a>
      </div>
      <div className="nav">
        <Brand />
        <nav className="desktopNav" aria-label="Primary navigation">
          {nav.map(([l, h]) => (
            <Link key={h} href={h}>
              {l}
            </Link>
          ))}
        </nav>
        <details className="mobileMenu">
          <summary>
            <span>Menu</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {nav.map(([l, h]) => (
              <Link key={h} href={h}>
                {l}
              </Link>
            ))}
            <Link href="/contact">Contact</Link>
            <Link href="/discuss-a-project">Discuss a Project</Link>
          </nav>
        </details>
        <Link className="search" href="/insights" aria-label="Explore insights">
          ⌕
        </Link>
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer">
        <div>
          <Link href="/" className="footerWordmark">
            PROCESSPILOT
          </Link>
          <p>Strategy. Engineering. Security.</p>
          <p className="fine">
            <strong>Headquarters</strong>
            <br />
            24044 Cinco Village Center Blvd, Suite 100
            <br />
            Katy, TX 77494
            <br />
            <br />
            <strong>DC Office</strong>
            <br />
            1629 K St NW, Suite 300
            <br />
            Washington, DC 20006
            <br />
            <br />
            <a href="tel:+13467454398">(346) 745-4398</a> ·{" "}
            <a href="mailto:info@processpilottech.com">
              info@processpilottech.com
            </a>
          </p>
        </div>
        <div>
          <b>Explore</b>
          {nav.slice(0, 4).map(([l, h]) => (
            <Link key={h} href={h}>
              {l}
            </Link>
          ))}
        </div>
        <div>
          <b>Company</b>
          {nav.slice(4).map(([l, h]) => (
            <Link key={h} href={h}>
              {l}
            </Link>
          ))}
          <Link href="/contact">Contact</Link>
        </div>
        <div>
          <b>Trust</b>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/security">Security</Link>
        </div>
        <div>
          <b>Portfolio</b>
          <a
            href="https://theboringproduct.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Boring Product
          </a>
        </div>
      </div>
      <div className="copy">© 2026 ProcessPilot Technologies LLC. All rights reserved.</div>
    </footer>
  );
}
function Hero({
  eye,
  title,
  text,
}: {
  eye: string;
  title: string;
  text: string;
}) {
  return (
    <section className="pagehero">
      <div className="wrap">
        <p className="eyebrow">{eye}</p>
        <h1>{title}</h1>
        <p className="lede">{text}</p>
      </div>
    </section>
  );
}
function CTA() {
  return (
    <section className="cta">
      <div>
        <p className="eyebrow orange">Start the conversation</p>
        <h2>What are you ready to build, secure, or modernize?</h2>
      </div>
      <Link className="btn light" href="/discuss-a-project">
        Discuss a Project
      </Link>
    </section>
  );
}
function TechnologyBand() {
  const brands = [
    ["Microsoft Azure", "https://api.iconify.design/logos/microsoft-azure.svg"],
    ["AWS", "https://api.iconify.design/logos/aws.svg"],
    ["Google Cloud", "https://api.iconify.design/logos/google-cloud.svg"],
    ["Docker", "https://api.iconify.design/logos/docker-icon.svg"],
    ["GitHub", "https://api.iconify.design/logos/github-icon.svg"],
    ["PostgreSQL", "https://api.iconify.design/logos/postgresql.svg"],
    ["Python", "https://api.iconify.design/logos/python.svg"],
    ["Cloudflare", "https://api.iconify.design/logos/cloudflare-icon.svg"],
    ["Cursor", "https://api.iconify.design/simple-icons/cursor.svg"],
    [
      "Claude",
      "https://api.iconify.design/simple-icons/claude.svg?color=%23D97757",
    ],
    [
      "OpenAI",
      "https://api.iconify.design/simple-icons/openai.svg?color=%2310A37F",
    ],
    ["Git Bash", "https://api.iconify.design/logos/git-icon.svg"],
    [
      "Splunk",
      "https://api.iconify.design/simple-icons/splunk.svg?color=%2365A637",
    ],
    ["IBM BigFix", "https://api.iconify.design/logos/ibm.svg"],
    ["Jira", "https://api.iconify.design/logos/jira.svg"],
    ["Supabase", "https://api.iconify.design/logos/supabase-icon.svg"],
    ["Vercel", "https://api.iconify.design/logos/vercel-icon.svg"],
    ["Lovable", "https://lovable.dev/favicon.ico"],
    ["Resend", "https://api.iconify.design/simple-icons/resend.svg"],
    ["Pinecone", "https://api.iconify.design/logos/pinecone-icon.svg"],
  ] as const;
  const heading = "Technology ecosystems we build and secure your systems with";
  return (
    <section className="techBand" aria-label={heading}>
      <p>{heading}</p>
      <div className="logoViewport">
        <div className="logoTrack">
          {[...brands, ...brands].map(([name, src], i) => (
            <div
              className="techLogo"
              key={`${name}-${i}`}
              aria-hidden={i >= brands.length || undefined}
            >
              <img src={src} alt={i < brands.length ? name : ""} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function Home() {
  return (
    <>
      <section className="missionHero">
        <div className="missionHeroInner">
          <p className="eyebrow">INTELLIGENCE. RESILIENCE. DELIVERY.</p>
          <h1>Technology built for consequential missions.</h1>
          <p className="lede">ProcessPilot brings AI, cybersecurity, digital modernization, and intelligent engineering together to help organizations move securely from strategy to execution.</p>
          <Link className="missionLink" href="/capabilities">Explore our capabilities <span>→</span></Link>
        </div>
        <div className="missionHeroTag"><span>SECURE BY DESIGN</span><b>ADVANCING WHAT MATTERS</b></div>
      </section>
      <section className="depthIntro wrap">
        <p className="eyebrow">MISSION DEPTH</p>
        <h2>ProcessPilot expertise runs deep.</h2>
        <p>Emerging technology creates value only when it is engineered responsibly, secured deliberately, and aligned to the mission. We combine technical depth with practical delivery to help clients solve high-stakes challenges.</p>
      </section>
      <section className="missionCapabilities wrap" aria-label="Consulting capabilities">
        {[
          ["01", "Cybersecurity & Resilience", "Protect critical operations through risk-based security, Zero Trust, vulnerability management, continuous monitoring, and authorization support.", "/capabilities"],
          ["02", "Data & Artificial Intelligence", "Design secure AI agents, governed RAG systems, knowledge assistants, and automation grounded in accountable human decisions.", "/capabilities"],
          ["03", "Digital Modernization", "Modernize workflows, cloud environments, integrations, and delivery practices without losing control of risk or mission continuity.", "/capabilities"],
          ["04", "Intelligent Engineering", "Move from advisory to working systems through architecture, software engineering, secure integration, testing, and operationalization.", "/capabilities"],
        ].map(([number, title, description, href]) => (
          <Link href={href} key={title} className="missionCapability">
            <div className="capabilityArt" aria-hidden="true" />
            <div className="capabilityCopy"><small>{number}</small><h3>{title}</h3><p>{description}</p><b>Learn more →</b></div>
          </Link>
        ))}
      </section>
      <section className="missionSafe">
        <div className="missionSafeVisual" aria-hidden="true"><span>MISSION</span><span>READY</span></div>
        <div className="missionSafeCopy">
          <p className="eyebrow">TECHNOLOGY DRIVEN</p>
          <h2>Your mission is safe with us.</h2>
          <p>ProcessPilot connects cyber, data and AI, digital modernization, and engineering so clients can move faster without separating innovation from security.</p>
          <Link className="missionLink" href="/about">Who we are <span>→</span></Link>
        </div>
      </section>
      <section className="markets wrap">
        <p className="eyebrow">WHERE WE SERVE</p>
        <h2>Mission-aligned across public and commercial sectors.</h2>
        <div className="marketGrid">
          {[
            ["Federal & Public Sector", "Secure mission delivery, RMF and ATO support, AI governance, Zero Trust, and modernization for public-sector environments."],
            ["Regulated Enterprise", "Responsible AI, resilient cyber programs, workflow modernization, and control evidence for organizations where trust is essential."],
            ["Technology & Professional Services", "Secure AI engineering, digital platforms, cloud integration, and delivery acceleration for technology-led organizations."],
          ].map(([title, copy]) => <Link href="/industries" key={title}><span>↗</span><h3>{title}</h3><p>{copy}</p></Link>)}
        </div>
      </section>
      <section className="innovationDelivered">
        <div className="innovationPhoto" role="img" aria-label="Engineers collaborating on autonomous and aerospace-grade systems" />
        <div className="wrap innovationContent">
          <p className="eyebrow">INNOVATION DELIVERED</p>
          <div className="innovationGrid">
            <h2>From complex challenge to operational capability.</h2>
            <div><p>We assess, strategize, engineer, secure, and operationalize. The result is practical technology that can be governed, defended, and used with confidence.</p><Link className="missionLink" href="/discuss-a-project">Start a conversation <span>→</span></Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
function Capabilities() {
  return (
    <>
      <Hero
        eye="Capabilities"
        title="AI agents, secure systems, and governed delivery."
        text="We design and build custom AI agents, agentic applications, multi-agent systems, and cybersecurity capabilities for organizations that need technology to work—and withstand scrutiny."
      />
      <section className="wrap cards two">
        {caps.map(([t, d, a], i) => (
          <article className="card" key={t}>
            <small>0{i + 1}</small>
            <h2>{t}</h2>
            <p>{d}</p>
            <ul>
              {a.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <CTA />
    </>
  );
}
function Industries() {
  return (
    <>
      <Hero
        eye="Industries"
        title="Built for consequential environments."
        text="We support teams where security, compliance, operational continuity, and responsible AI adoption are business requirements."
      />
      <section className="wrap cards three">
        {industries.map(([t, d]) => (
          <article className="card" key={t}>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <CTA />
    </>
  );
}
function Contracting() {
  const tags = [
    "Agentic AI",
    "Secure AI",
    "AI governance",
    "Cybersecurity assessments",
    "RMF / ATO",
    "FedRAMP",
    "Zero Trust",
    "Cloud security",
    "Vulnerability management",
    "Continuous monitoring",
    "Custom software engineering",
    "Workflow automation",
    "API/data integration",
  ];
  return (
    <>
      <Hero
        eye="Contracting & Partnerships"
        title="Ready to support mission and delivery."
        text="ProcessPilot pursues federal, state, local, and commercial opportunities as a prime, subcontractor, or focused delivery partner."
      />
      <section className="wrap split">
        <div>
          <p className="eyebrow">Contract capabilities</p>
          <h2>
            Specialized capability across AI, cyber, and digital delivery.
          </h2>
          <div className="tags">
            {tags.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
        <aside className="panel">
          <h3>Procurement contact</h3>
          <p>
            <b>ProcessPilot Technologies LLC</b>
            <br />
            Nationwide delivery
          </p>
          <p>
            <a href="mailto:info@processpilottech.com">
              info@processpilottech.com
            </a>
            <br />
            (346) 745-4398
          </p>
        </aside>
      </section>
      <section className="band">
        <div className="wrap cards three">
          <article>
            <h3>Capability Statement</h3>
            <p>
              Available upon request for qualified procurement and teaming
              conversations.
            </p>
          </article>
          <article>
            <h3>Teaming & Subcontracting</h3>
            <p>Focused technical support for primes and delivery partners.</p>
          </article>
          <article>
            <h3>RFP / RFQ Response</h3>
            <p>
              Technical narratives, solution architecture, staffing strategy,
              and compliance mapping.
            </p>
          </article>
        </div>
      </section>
      <section className="wrap">
        <div className="registrationHead">
          <div>
            <p className="eyebrow">Federal registration</p>
            <h2>Registration details</h2>
          </div>
          <div className="samActive">
            <span />
            <small>SAM.GOV STATUS</small>
            <b>Active</b>
          </div>
        </div>
        <div className="naicsGrid">
          {[
            ["541511", "Custom Computer Programming Services"],
            ["541512", "Computer Systems Design Services"],
            ["541519", "Other Computer Related Services"],
            [
              "541611",
              "Administrative Management and General Management Consulting Services",
            ],
          ].map(([code, label]) => (
            <div key={code}>
              <b>{code}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="fine">
          NAICS classifications reflect the company’s software engineering,
          systems design, cybersecurity, AI, and consulting capabilities. No
          contract vehicles, certifications, socioeconomic status, awards, or
          partner designations are represented.
        </p>
      </section>
      <CTA />
    </>
  );
}
const eng = [
  [
    "Federal Maritime Commission",
    "Federal Agency End Client",
    "Cybersecurity assessment and federal compliance experience.",
  ],
  [
    "Massed Compute",
    "Independent Contract Engagement",
    "FedRAMP-oriented assessment and advisory support.",
  ],
  [
    "PiTech Solutions",
    "Prime / Delivery Partner",
    "Cybersecurity and federal delivery collaboration.",
  ],
  [
    "Bank of America",
    "Prior Contractor Engagement",
    "Enterprise technology and delivery experience.",
  ],
  [
    "Booz Allen Hamilton",
    "Prior Contractor Engagement",
    "Federal consulting and mission delivery experience.",
  ],
  [
    "U.S. Department of Justice",
    "Federal Agency End Client",
    "Cybersecurity governance, compliance, and authorization experience.",
  ],
  [
    "U.S. Army / DISA / Defense Health Agency",
    "Federal Agency End Clients",
    "DoD cybersecurity, RMF, infrastructure, and mission assurance experience.",
  ],
  [
    "U.S. Department of State / CISA",
    "Federal Agency End Clients",
    "AI, cybersecurity, and public-sector program experience.",
  ],
  [
    "MedStar Health",
    "Prior Contractor Engagement",
    "Healthcare technology delivery experience.",
  ],
] as const;
function Engagements() {
  return (
    <>
      <Hero
        eye="Client Engagements"
        title="Selected Organizations & Engagement Experience"
        text="A transparent view of organizational experience connected to our team—without implying endorsement or direct corporate relationships where none exist."
      />
      <section className="wrap">
        <div className="notice">
          <b>Relationship disclosure</b>
          <p>
            Entries may reflect direct work, independent contracts, federal end
            clients, prior employment or contractor experience, or
            prime/delivery relationships. They do not imply endorsement, an
            active contract, or that every organization is a direct client.
          </p>
        </div>
        <div className="eng">
          {eng.map(([n, s, d]) => (
            <article key={n}>
              <span className="status">{s}</span>
              <h2>{n}</h2>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <p className="fine">
          Additional delivery and prime experience may include Maximus Federal,
          KForce, Ignite IT, IntelliDyne, SAIC, ICF, and Apex Systems. No logos
          or government seals are used. Confidential details are excluded.
        </p>
      </section>
    </>
  );
}
function Insights() {
  return (
    <>
      <Hero
        eye="Insights"
        title="Practical thinking for secure AI adoption."
        text="Executive-ready perspectives on agentic AI, AI security, federal compliance, and resilient technology delivery."
      />
      <section className="wrap comingSoon">
        <p className="eyebrow">Coming soon</p>
        <h2>Research-backed perspectives are on the way.</h2>
        <p className="large">
          We are preparing practical guidance on secure agentic AI, NIST AI RMF,
          AI red teaming, FedRAMP readiness, prompt injection, secure RAG, and
          AI governance.
        </p>
      </section>
    </>
  );
}
function About() {
  return (
    <>
      <Hero
        eye="About"
        title="AI and cybersecurity, built together."
        text="ProcessPilot is an AI, cybersecurity, and technology consulting company serving organizations nationwide."
      />
      <section className="wrap split">
        <div>
          <h2>We design, build, and secure systems organizations can trust.</h2>
          <p className="large">
            We advise, design, engineer, and secure AI systems, agentic
            applications, workflow automation, and cybersecurity capabilities
            for commercial, regulated, and public-sector environments.
          </p>
        </div>
        <div className="principles">
          {[
            "Secure by design",
            "Measurable outcomes",
            "Responsible AI",
            "Accountability",
            "Engineering capability",
            "AI + cybersecurity expertise",
            "Headquarters",
            "Nationwide delivery",
          ].map((x, i) => (
            <div key={x}>
              <span>0{i + 1}</span>
              <b>{x}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="band serviceAreas" aria-labelledby="service-areas-title">
        <div className="wrap">
          <p className="eyebrow">Service areas</p>
          <h2 id="service-areas-title">Consulting delivery across key U.S. markets.</h2>
          <p className="large">
            ProcessPilot supports commercial, regulated, and public-sector
            organizations nationwide, with focused service coverage in these
            major markets.
          </p>
          <div className="serviceGrid">
            {["Washington, DC", "Northern Virginia", "Baltimore, Maryland", "Maryland", "Austin, Texas", "Houston, Texas", "Atlanta, Georgia"].map((area) => (
              <div key={area}><span aria-hidden="true">●</span><b>{area}</b></div>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
function Form() {
  return (
    <>
      <Hero
        eye="Discuss a Project"
        title="Tell us what you’re building—or protecting."
        text="Contact ProcessPilot directly to discuss your opportunity, challenge, or mission."
      />
      <section className="wrap directContact">
        <div>
          <p className="eyebrow">Email</p>
          <h2><a href="mailto:info@processpilottech.com">info@processpilottech.com</a></h2>
          <p className="large">Send a short description of your organization, project, desired timeline, and the best way to reach you.</p>
          <a className="btn" href="mailto:info@processpilottech.com?subject=ProcessPilot%20Project%20Inquiry">Email ProcessPilot</a>
        </div>
        <div>
          <p className="eyebrow">Phone</p>
          <h2><a href="tel:+13467454398">(346) 745-4398</a></h2>
          <p className="large">Call to discuss consulting, contracting, teaming, AI engineering, or cybersecurity requirements.</p>
          <a className="missionLink" href="tel:+13467454398">Call ProcessPilot <span>→</span></a>
        </div>
      </section>
    </>
  );
}
function Simple({
  kind,
}: {
  kind: "privacy" | "terms" | "security" | "contact";
}) {
  if (kind === "contact")
    return (
      <>
        <Hero
          eye="ProcessPilot"
          title="Contact"
          text="For projects, procurement, partnerships, and teaming opportunities, contact our team."
        />
        <section className="wrap prose">
          <h2>Headquarters</h2>
          <p>
            ProcessPilot Technologies LLC
            <br />
            24044 Cinco Village Center Blvd, Suite 100
            <br />
            Katy, TX 77494
          </p>
          <h2>DC Office</h2>
          <p>
            ProcessPilot Technologies LLC
            <br />
            1629 K St NW, Suite 300
            <br />
            Washington, DC 20006
          </p>
          <p>
            <a href="mailto:info@processpilottech.com">
              info@processpilottech.com
            </a>{" "}
            · <a href="tel:+13467454398">(346) 745-4398</a>
          </p>
          <h2>Service areas</h2>
          <p>
            Washington, DC · Northern Virginia · Baltimore, Maryland · Maryland
            · Austin, Texas · Houston, Texas · Atlanta, Georgia · Nationwide
            delivery
          </p>
          <Link className="btn" href="/discuss-a-project">
            Discuss a Project
          </Link>
        </section>
      </>
    );
  if (kind === "privacy")
    return (
      <>
        <Hero
          eye="Trust"
          title="Privacy"
          text="How ProcessPilot handles information submitted through this website."
        />
        <section className="wrap prose legal">
          <h2>Information we collect</h2>
          <p>
            When you submit a project inquiry, we collect the information you
            provide, which may include your name, work email, organization,
            phone number, project type, budget range, timeline, and project
            summary. We also process limited technical information used for
            security, spam prevention, and rate limiting.
          </p>
          <h2>How we use information</h2>
          <p>
            We use submitted information to evaluate and respond to inquiries,
            plan potential engagements, protect the website, maintain business
            records, and meet legal obligations. We do not sell personal
            information.
          </p>
          <h2>Storage and retention</h2>
          <p>
            Inquiry records are stored in access-controlled systems and retained
            only as long as reasonably necessary for the purposes described
            above, legitimate business needs, and applicable legal requirements.
          </p>
          <h2>Your choices</h2>
          <p>
            You may request access, correction, or deletion of information you
            submitted by contacting{" "}
            <a href="mailto:info@processpilottech.com">
              info@processpilottech.com
            </a>
            . We may retain limited records when legally required or necessary
            to protect our rights.
          </p>
          <h2>Contact</h2>
          <p>
            ProcessPilot Technologies LLC
            <br />
            Headquarters
            <br />
            24044 Cinco Village Center Blvd, Suite 100
            <br />
            Katy, TX 77494
            <br />
            <br />
            DC Office
            <br />
            1629 K St NW, Suite 300
            <br />
            Washington, DC 20006
          </p>
          <p className="fine">Last reviewed: August 2026.</p>
        </section>
      </>
    );
  if (kind === "terms")
    return (
      <>
        <Hero
          eye="Trust"
          title="Terms of Use"
          text="Terms governing use of the ProcessPilot website."
        />
        <section className="wrap prose legal">
          <h2>Informational use</h2>
          <p>
          This website provides general information about ProcessPilot, its
          consulting capabilities, and potential services. Content is not a
            warranty, professional advice, a binding proposal, or a contract
            offer.
          </p>
          <h2>Acceptable use</h2>
          <p>
            You may not misuse the website, interfere with its operation,
            attempt unauthorized access, submit unlawful or malicious content,
            or use automated methods that unreasonably burden the service.
          </p>
          <h2>Intellectual property</h2>
          <p>
            Website content, branding, designs, and original materials are owned
            by ProcessPilot or used with permission. No rights are granted
            except the limited right to view and use the website lawfully.
          </p>
          <h2>Technology and professional-services disclaimer</h2>
          <p>
            Descriptions of AI, cybersecurity, healthcare, financial-services,
            real-estate, compliance, and government capabilities are general.
            Suitability, regulatory requirements, security controls, and
            deliverables depend on the final scope and written agreement.
            Nothing on this site constitutes medical, legal, or financial
            advice.
          </p>
          <h2>Changes and contact</h2>
          <p>
            We may update this website and these terms. Questions may be sent to{" "}
            <a href="mailto:info@processpilottech.com">
              info@processpilottech.com
            </a>
            .
          </p>
          <p className="fine">Last reviewed: August 2026.</p>
        </section>
      </>
    );
  return (
    <>
      <Hero
        eye="Trust"
        title="Security"
        text="Security is integrated into how we design, build, and operate digital capabilities."
      />
      <section className="wrap prose legal">
        <h2>Website safeguards</h2>
        <p>
          ProcessPilot uses encrypted transport, server-side validation,
          request-size restrictions, rate limiting, spam controls,
          access-controlled data storage, and security-focused response headers
          to protect this website and its inquiry workflow.
        </p>
        <h2>Responsible disclosure</h2>
        <p>
          If you believe you have identified a security issue affecting this
          website, email{" "}
          <a href="mailto:info@processpilottech.com">
            info@processpilottech.com
          </a>{" "}
          with a clear description and steps to reproduce it. Do not access,
          alter, retain, or disclose data that does not belong to you.
        </p>
        <h2>Scope</h2>
        <p>
          No certification, authorization, audit result, or guarantee of
          absolute security is implied unless explicitly stated in a written and
          verifiable agreement.
        </p>
        <p className="fine">Last reviewed: August 2026.</p>
      </section>
    </>
  );
}
export function SitePage({ page }: { page: PageKey }) {
  const map: Record<PageKey, ReactNode> = {
    home: (
      <>
        <Home />
        <CTA />
      </>
    ),
    capabilities: <Capabilities />,
    industries: <Industries />,
    contracting: <Contracting />,
    "client-engagements": <Engagements />,
    insights: <Insights />,
    about: <About />,
    "discuss-a-project": <Form />,
    privacy: <Simple kind="privacy" />,
    terms: <Simple kind="terms" />,
    security: <Simple kind="security" />,
    contact: <Simple kind="contact" />,
  };
  return (
    <>
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <main id="main-content">{map[page]}</main>
      <Footer />
    </>
  );
}
