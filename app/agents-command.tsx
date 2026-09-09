'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './agents-command.module.css';

type AgentStatus = 'Searching' | 'Reviewing' | 'Qualifying' | 'Escalating' | 'Idle';

type Agent = {
  state: string;
  code: string;
  region: string;
  status: AgentStatus;
  task: string;
  opportunities: number;
  lastAction: string;
  tools: string[];
};

type Approval = {
  id: number;
  title: string;
  agency: string;
  state: string;
  due: string;
  value: string;
  fit: number;
  status: 'Pending' | 'Approved' | 'Declined';
};

const STATES = [
  ['Alabama','AL','Southeast'],['Alaska','AK','West'],['Arizona','AZ','West'],['Arkansas','AR','South'],['California','CA','West'],['Colorado','CO','Mountain'],['Connecticut','CT','Northeast'],['Delaware','DE','Mid-Atlantic'],['Florida','FL','Southeast'],['Georgia','GA','Southeast'],['Hawaii','HI','Pacific'],['Idaho','ID','Mountain'],['Illinois','IL','Midwest'],['Indiana','IN','Midwest'],['Iowa','IA','Midwest'],['Kansas','KS','Midwest'],['Kentucky','KY','South'],['Louisiana','LA','South'],['Maine','ME','Northeast'],['Maryland','MD','Mid-Atlantic'],['Massachusetts','MA','Northeast'],['Michigan','MI','Midwest'],['Minnesota','MN','Midwest'],['Mississippi','MS','South'],['Missouri','MO','Midwest'],['Montana','MT','Mountain'],['Nebraska','NE','Midwest'],['Nevada','NV','West'],['New Hampshire','NH','Northeast'],['New Jersey','NJ','Mid-Atlantic'],['New Mexico','NM','Southwest'],['New York','NY','Northeast'],['North Carolina','NC','Southeast'],['North Dakota','ND','Midwest'],['Ohio','OH','Midwest'],['Oklahoma','OK','South'],['Oregon','OR','West'],['Pennsylvania','PA','Mid-Atlantic'],['Rhode Island','RI','Northeast'],['South Carolina','SC','Southeast'],['South Dakota','SD','Midwest'],['Tennessee','TN','South'],['Texas','TX','South'],['Utah','UT','Mountain'],['Vermont','VT','Northeast'],['Virginia','VA','Mid-Atlantic'],['Washington','WA','West'],['West Virginia','WV','Appalachia'],['Wisconsin','WI','Midwest'],['Wyoming','WY','Mountain']
] as const;

const TASKS = [
  'Scanning state procurement portal',
  'Reviewing solicitation documents',
  'Checking NAICS and set-aside fit',
  'Evaluating cybersecurity scope',
  'Comparing requirements to capabilities',
  'Extracting submission deadline',
  'Checking incumbent and award history',
  'Preparing opportunity brief for ME',
];

const STATUS: AgentStatus[] = ['Searching','Searching','Reviewing','Qualifying','Searching','Escalating'];

const initialAgents: Agent[] = STATES.map(([state, code, region], i) => ({
  state,
  code,
  region,
  status: STATUS[i % STATUS.length],
  task: TASKS[i % TASKS.length],
  opportunities: (i * 7 + 3) % 9,
  lastAction: `${3 + (i % 21)} min ago`,
  tools: ['State procurement portal','SAM.gov','Google Search','Document analyzer','Opportunity scorer'],
}));

const seedApprovals: Approval[] = [
  { id: 1, title: 'AI Governance & Risk Support', agency: 'State Technology Office', state: 'TX', due: 'Sep 24', value: '$1.2M', fit: 94, status: 'Pending' },
  { id: 2, title: 'Cybersecurity Program Support', agency: 'Department of Administration', state: 'VA', due: 'Sep 29', value: '$840K', fit: 91, status: 'Pending' },
  { id: 3, title: 'Secure Workflow Automation', agency: 'Health Services Agency', state: 'CA', due: 'Oct 3', value: '$650K', fit: 88, status: 'Pending' },
];

function statusClass(status: AgentStatus) {
  return styles[`status${status}` as keyof typeof styles] || '';
}

export default function AgentsCommand() {
  const [agents, setAgents] = useState(initialAgents);
  const [selected, setSelected] = useState<Agent | null>(initialAgents[42]);
  const [approvals, setApprovals] = useState(seedApprovals);
  const [filter, setFilter] = useState('All');
  const [activity, setActivity] = useState([
    'TX Agent found a high-fit AI governance opportunity.',
    'VA Agent escalated a cybersecurity solicitation to ME.',
    'CA Agent is extracting requirements from a 62-page RFP.',
    'FL Agent completed a no-bid decision and resumed searching.',
    'NY Agent matched a solicitation to ProcessPilot Secure AI capabilities.',
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgents(current => {
        const index = Math.floor(Math.random() * current.length);
        const next = [...current];
        const old = next[index];
        const status = STATUS[Math.floor(Math.random() * STATUS.length)];
        const task = TASKS[Math.floor(Math.random() * TASKS.length)];
        next[index] = { ...old, status, task, lastAction: 'just now', opportunities: old.opportunities + (Math.random() > .78 ? 1 : 0) };
        setActivity(items => [`${old.code} Agent — ${task}.`, ...items].slice(0, 8));
        if (selected?.code === old.code) setSelected(next[index]);
        return next;
      });
    }, 4200);
    return () => window.clearInterval(timer);
  }, [selected?.code]);

  const filtered = useMemo(() => filter === 'All' ? agents : agents.filter(a => a.status === filter), [agents, filter]);
  const searching = agents.filter(a => a.status === 'Searching').length;
  const reviewing = agents.filter(a => a.status === 'Reviewing' || a.status === 'Qualifying').length;
  const escalated = approvals.filter(a => a.status === 'Pending').length;
  const opportunities = agents.reduce((sum, a) => sum + a.opportunities, 0);

  function decide(id: number, status: 'Approved' | 'Declined') {
    setApprovals(rows => rows.map(row => row.id === id ? { ...row, status } : row));
    const item = approvals.find(row => row.id === id);
    if (item) setActivity(items => [`ME ${status.toLowerCase()} ${item.state} — ${item.title}.`, ...items].slice(0,8));
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.logo}>PP</span><div><strong>ProcessPilot</strong><small>Technologies LLC</small></div></div>
        <nav className={styles.nav}>
          <button className={styles.active}>⌂ Command Center</button>
          <button>◎ Agents <span>50</span></button>
          <button>◫ Opportunities <span>{opportunities}</span></button>
          <button>✓ ME Approvals <span>{escalated}</span></button>
          <button>↗ Activity</button>
          <button>⚙ Tools & Plugins</button>
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.systemDot}/>
          <div><strong>Agent network online</strong><small>50 state desks active</small></div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div><p className={styles.eyebrow}>PROCUREMENT OPERATIONS</p><h1>ProcessPilot Agents</h1><p>Autonomous contract discovery command center</p></div>
          <div className={styles.meBadge}><span>ME</span><div><strong>Executive Review</strong><small>{escalated} items need attention</small></div></div>
        </header>

        <section className={styles.metrics}>
          <article><span>ACTIVE AGENTS</span><strong>50</strong><small>All states covered</small></article>
          <article><span>SEARCHING NOW</span><strong>{searching}</strong><small>Procurement portals</small></article>
          <article><span>IN REVIEW</span><strong>{reviewing}</strong><small>Reading & qualifying</small></article>
          <article><span>OPPORTUNITIES</span><strong>{opportunities}</strong><small>Tracked by agents</small></article>
          <article className={styles.attention}><span>NEEDS ME</span><strong>{escalated}</strong><small>Awaiting decision</small></article>
        </section>

        <div className={styles.grid}>
          <section className={styles.agentPanel}>
            <div className={styles.panelHead}><div><h2>Agent Floor</h2><p>Each state agent owns discovery, qualification, and escalation.</p></div><div className={styles.filters}>{['All','Searching','Reviewing','Qualifying','Escalating'].map(x => <button key={x} className={filter===x?styles.filterActive:''} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>
            <div className={styles.agentGrid}>
              {filtered.map((agent, index) => (
                <button key={agent.code} className={`${styles.agentCard} ${selected?.code===agent.code?styles.agentSelected:''}`} onClick={()=>setSelected(agent)}>
                  <div className={styles.agentTop}><span className={styles.avatar}>{agent.code}</span><span className={`${styles.status} ${statusClass(agent.status)}`}>{agent.status}</span></div>
                  <strong>{agent.state} Agent</strong>
                  <p>{agent.task}</p>
                  <div className={styles.progress}><i style={{width:`${34 + ((index*13)%63)}%`}}/></div>
                  <footer><span>{agent.opportunities} opportunities</span><span>{agent.lastAction}</span></footer>
                  <span className={styles.motionDot} style={{animationDelay:`-${index%8}s`}}/>
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.rightRail}>
            <section className={styles.livePanel}>
              <div className={styles.panelHead}><div><h2>Live Activity</h2><p>What the team is doing now</p></div><span className={styles.live}>LIVE</span></div>
              <div className={styles.activityFeed}>{activity.map((item,i)=><div key={`${item}-${i}`}><span className={styles.feedDot}/><p>{item}</p><small>{i===0?'now':`${i*2+1}m`}</small></div>)}</div>
            </section>

            <section className={styles.approvals}>
              <div className={styles.panelHead}><div><h2>ME Inbox</h2><p>Human-in-the-loop decisions</p></div><span className={styles.count}>{escalated}</span></div>
              {approvals.map(item => (
                <article key={item.id} className={item.status !== 'Pending' ? styles.resolved : ''}>
                  <div><span>{item.state}</span><strong>{item.fit}% fit</strong></div>
                  <h3>{item.title}</h3><p>{item.agency} · Due {item.due} · {item.value}</p>
                  {item.status === 'Pending' ? <footer><button onClick={()=>decide(item.id,'Declined')}>Decline</button><button onClick={()=>decide(item.id,'Approved')}>Approve</button></footer> : <small className={styles.decision}>{item.status}</small>}
                </article>
              ))}
            </section>
          </aside>
        </div>
      </section>

      {selected && <aside className={styles.drawer}>
        <button className={styles.close} onClick={()=>setSelected(null)}>×</button>
        <div className={styles.drawerHero}><span className={styles.bigAvatar}>{selected.code}</span><div><p>{selected.region} Region</p><h2>{selected.state} Procurement Agent</h2><span className={`${styles.status} ${statusClass(selected.status)}`}>{selected.status}</span></div></div>
        <section><span className={styles.sectionLabel}>CURRENT ASSIGNMENT</span><h3>{selected.task}</h3><p>Monitoring public-sector sources, reading solicitation material, checking fit against ProcessPilot Technologies capabilities, and escalating only opportunities that warrant executive review.</p></section>
        <div className={styles.agentStats}><div><strong>{selected.opportunities}</strong><span>Opportunities</span></div><div><strong>24/7</strong><span>Coverage</span></div><div><strong>{selected.lastAction}</strong><span>Last action</span></div></div>
        <section><span className={styles.sectionLabel}>TOOLS & PLUGINS</span><div className={styles.toolList}>{selected.tools.map(tool=><span key={tool}>✓ {tool}</span>)}</div></section>
        <section><span className={styles.sectionLabel}>WORKFLOW</span><ol className={styles.workflow}><li className={styles.done}>Search procurement sources</li><li className={styles.done}>Open & read solicitation</li><li className={styles.current}>Determine ProcessPilot fit</li><li>Build opportunity brief</li><li>Escalate to ME when warranted</li></ol></section>
        <button className={styles.primary}>Open full agent workspace →</button>
      </aside>}
    </main>
  );
}
