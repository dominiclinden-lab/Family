import { supabase } from "./supabase.js"

const input = document.getElementById("input")
const messages = document.getElementById("messages")

let householdId = null

// INIT USER + HOUSEHOLD
async function init() {
  const { data: user } = await supabase.auth.getUser()

  if (!user.user) {
    const email = prompt("Enter email")
    await supabase.auth.signInWithOtp({ email })
    alert("Check your email for login link")
    return
  }

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.user.id)
    .single()

  householdId = member.household_id

  updateAll()
  loadEvents()
}

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const text = input.value
    input.value = ""

    messages.innerHTML += `<div>${text}</div>`

    const parsed = parseInput(text)

    if (parsed) {
      parsed.household_id = householdId
      await supabase.from("transactions").insert(parsed)
    }

    updateAll()
  }
})

// CHAT PARSER
function parseInput(text) {
  text = text.toLowerCase()
  const amount = parseFloat(text.match(/\d+/)?.[0])
  if (!amount) return null

  if (text.includes("spent")) {
    return { type: "expense", amount, category: "general" }
  }

  if (text.includes("salary")) {
    return { type: "income", amount, category: "salary" }
  }

  return null
}

// DASHBOARD
async function updateDashboard() {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)

  let total = 0
  data.forEach(t => total += t.type === "income" ? t.amount : -t.amount)

  document.getElementById("health").innerText =
    total > 0 ? "🟢 Strong" : "🔴 Risk"

  new Chart(document.getElementById("netChart"), {
    type: "line",
    data: {
      labels: data.map(d => new Date(d.created_at).toLocaleDateString()),
      datasets: [{ data: data.map(() => total) }]
    }
  })
}

// MORTGAGE
function calculateMonthly(loan, rate, years) {
  const r = rate / 100 / 12
  const n = years * 12
  return loan * (r * (1+r)**n) / ((1+r)**n - 1)
}

async function saveMortgage() {
  const loan = parseFloat(document.getElementById("loan").value)
  const years = parseInt(document.getElementById("years").value)
  const margin = parseFloat(document.getElementById("margin").value)
  const euriborType = document.getElementById("euriborType").value

  await supabase.from("mortgage").upsert({
    household_id: householdId,
    total_loan: loan,
    remaining_loan: loan,
    loan_years: years,
    margin,
    euribor_type: euriborType
  })

  updateMortgage()
}

async function updateMortgage() {
  const { data } = await supabase
    .from("mortgage")
    .select("*")
    .eq("household_id", householdId)
    .single()

  if (!data) return

  const rate = data.margin + data.euribor_rate
  const monthly = calculateMonthly(data.remaining_loan, rate, data.loan_years)

  document.getElementById("mortgageInfo").innerHTML =
    `Rate: ${rate.toFixed(2)}% <br> Monthly: ${monthly.toFixed(0)}`

  document.getElementById("euribor").innerText =
    `${data.euribor_rate}%`
}

// EURIBOR
async function updateEuribor() {
  try {
    const res = await fetch("https://api.api-ninjas.com/v1/euribor", {
      headers: { "X-Api-Key": "YOUR_API_KEY" }
    })

    const data = await res.json()

    await supabase.from("mortgage")
      .update({ euribor_rate: data.rate })
      .eq("household_id", householdId)

  } catch {}
}

// CALENDAR
async function addEvent() {
  const title = document.getElementById("eventTitle").value
  const date = document.getElementById("eventDate").value

  await supabase.from("events").insert({
    household_id: householdId,
    title,
    event_date: date
  })

  loadEvents()
}

async function loadEvents() {
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("household_id", householdId)

  document.getElementById("events").innerHTML =
    data.map(e => `<div>${e.title} - ${e.event_date}</div>`).join("")
}

// AI INSIGHTS
async function generateInsights() {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)

  let income = 0, expense = 0
  data.forEach(t => {
    if (t.type === "income") income += t.amount
    else expense += t.amount
  })

  let insights = []

  if (expense > income) insights.push("⚠️ Spending too high")
  if (income - expense > 5000) insights.push("💡 Strong savings potential")

  document.getElementById("insights").innerHTML =
    insights.map(i => `<div>${i}</div>`).join("")
}

// NOTIFICATIONS
async function requestNotifications() {
  if ("Notification" in window) {
    await Notification.requestPermission()
  }
}

// MASTER UPDATE
async function updateAll() {
  await updateDashboard()
  await updateMortgage()
  await generateInsights()
}

// INIT
init()
requestNotifications()
setInterval(updateEuribor, 86400000)
