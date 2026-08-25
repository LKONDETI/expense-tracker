// ============================================================
// Mock Data — Replace with API calls in Phase 1 backend
// ============================================================

export const CURRENT_MONTH = 'August 2026'

export const SUMMARY_STATS = {
  totalSpent: 3214.62,
  prevMonthChange: +8,
  subscriptions: 142.45,
  activeSubscriptions: 7,
  budget: 4000,
  spent: 3214.62,
}

export const CATEGORY_SPEND = [
  { name: 'Housing',        amount: 1450.00, color: 'var(--cat-housing)' },
  { name: 'Dining',         amount: 412.00,  color: 'var(--cat-dining)' },
  { name: 'Groceries',      amount: 380.00,  color: 'var(--cat-groceries)' },
  { name: 'Transportation', amount: 210.00,  color: 'var(--cat-transport)' },
  { name: 'Subscriptions',  amount: 142.00,  color: 'var(--cat-subscriptions)' },
  { name: 'Shopping',       amount: 305.00,  color: 'var(--cat-shopping)' },
]

export const RECENT_TRANSACTIONS = [
  { id: 1,  date: 'Aug 12', merchant: 'Whole Foods Market', category: 'Groceries',      amount: -86.42 },
  { id: 2,  date: 'Aug 11', merchant: 'Uber',               category: 'Transportation', amount: -18.20 },
  { id: 3,  date: 'Aug 10', merchant: 'Netflix',            category: 'Subscriptions',  amount: -15.49 },
  { id: 4,  date: 'Aug 9',  merchant: "Trader Joe's",       category: 'Groceries',      amount: -52.10 },
  { id: 5,  date: 'Aug 8',  merchant: 'Local Coffee Co.',   category: 'Dining',         amount: -6.75 },
]

export const ALL_TRANSACTIONS = [
  { id: 1,  date: 'Aug 12', merchant: 'Whole Foods Market',  category: 'Groceries',      amount: -86.42 },
  { id: 2,  date: 'Aug 11', merchant: 'Uber',                category: 'Transportation', amount: -18.20 },
  { id: 3,  date: 'Aug 10', merchant: 'Netflix',             category: 'Subscriptions',  amount: -15.49 },
  { id: 4,  date: 'Aug 9',  merchant: "Trader Joe's",        category: 'Groceries',      amount: -52.10 },
  { id: 5,  date: 'Aug 8',  merchant: 'Local Coffee Co.',    category: 'Dining',         amount: -6.75 },
  { id: 6,  date: 'Aug 7',  merchant: 'Shell Gas Station',   category: 'Transportation', amount: -44.00 },
  { id: 7,  date: 'Aug 6',  merchant: 'Chipotle',            category: 'Dining',         amount: -14.35 },
  { id: 8,  date: 'Aug 5',  merchant: 'Amazon',              category: 'Shopping',       amount: -67.99 },
  { id: 9,  date: 'Aug 3',  merchant: 'Spotify',             category: 'Subscriptions',  amount: -10.99 },
  { id: 10, date: 'Aug 1',  merchant: 'Rent — Meridian Apts',category: 'Housing',        amount: -1450.00 },
]

export const CATEGORIES = ['All', 'Housing', 'Dining', 'Groceries', 'Transportation', 'Subscriptions', 'Shopping']

export const SUBSCRIPTIONS = [
  { id: 1, name: 'Netflix',              initial: 'N', renews: 'Aug 20', status: 'flat',   amount: 15.49 },
  { id: 2, name: 'Spotify',             initial: 'S', renews: 'Aug 23', status: 'flat',   amount: 10.99 },
  { id: 3, name: 'Adobe Creative Cloud',initial: 'A', renews: 'Sep 1',  status: 'up',     amount: 54.99 },
  { id: 4, name: 'iCloud+',             initial: 'i', renews: 'Aug 27', status: 'flat',   amount: 2.99 },
  { id: 5, name: 'Amazon Prime',        initial: 'A', renews: 'Sep 4',  status: 'flat',   amount: 14.99 },
  { id: 6, name: 'Gym Membership',      initial: 'G', renews: 'Aug 30', status: 'unused', amount: 39.00 },
  { id: 7, name: 'The New York Times',  initial: 'T', renews: 'Aug 25', status: 'flat',   amount: 4.00 },
]

export const INSIGHTS = {
  projectedMonthEnd: 4120,
  diningVsAvg: +22,
  unusedSubscriptions: 1,
  bullets: [
    { type: 'red',   text: 'Dining spend is up 22% versus your 3-month average — mostly weekday lunches.' },
    { type: 'red',   text: 'Gym Membership ($39/mo) has had no matching check-in activity in 45 days.' },
    { type: 'green', text: 'Groceries are down 9% this month, in line with fewer takeout orders.' },
    { type: 'blue',  text: "At the current pace, you're projected to end August at $4,120, $120 over budget." },
    { type: 'blue',  text: 'Transportation spend has stayed flat for three consecutive months.' },
  ],
}

export const SAMPLE_CHAT = [
  {
    id: 1,
    role: 'assistant',
    text: "Hi! I'm your Ledger assistant. Ask me anything about your spending — I only use your own transaction data to answer.",
    time: '9:00 AM',
  },
]

export const SUGGESTED_QUESTIONS = [
  'How much did I spend on dining last month?',
  'What are my biggest expenses this month?',
  'Am I over budget?',
  'Which subscriptions can I cancel?',
]
