import { supabase } from "./supabase.js"

let householdId = null

// NAVIGATION
window.switchTab = function(tab) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"))
  document.getElementById(tab).classList.add("active")

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"))
  event.target.classList.add("active")

  if (tab === "analytics") loadAnalytics()
}

// INIT
async function init() {
  const { data: user } = await supabase.auth.getUser()

  if (!user.user) {
    const email = prompt("Email")
    await supabase.auth.signInWithOtp({ email })
    alert("Check email")
    return
  }

  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.user.id)
    .single()

  householdId = data.household_id

  updateAll()
  loadEvents()
}

// CHAT
document.getElementById("input").addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const text = e.target.value
    e.target.value = ""

    const amount = parseFloat(text.match(/\d+/)?.[0])
    if (!amount) return

    let type = text.includes("spent") ? "expense" : "income"

    await supabase.from("transactions").insert({
      household_id: householdId,
      type,
      amount,
      category: "general"
    })

    updateAll()
  }
})

// DASHBOARD
async function updateDashboard() {
  const { data } = await supabase.from("transactions")
    .select("*").eq("household_id", householdId)

  let total = 0
  data.forEach(t => total += t.type === "income" ? t.amount : -t.amount)

  document.getElementById("health").innerText =
    total > 0 ? "🟢 Strong" : "🔴 Risk"

  new Chart(document.getElementById("netChart"), {
    type: "line",
    data: {
      labels: data.map(d => d.created_at),
      datasets: [{ data: data.map(()=>total) }]
    }
  })
}

// ANALYTICS
async function loadAnalytics() {
  const { data } = await supabase.from("transactions")
    .select("*").eq("household_id", householdId)

  let categories = {}

  data.forEach(t => {
    if (t.type === "expense") {
      categories[t.category] =
        (categories[t.category] || 0) + t.amount
    }
  })

  new Chart(document.getElementById("pieChart"), {
    type: "pie",
    data: {
      labels: Object.keys(categories),
      datasets: [{ data: Object.values(categories) }]
    }
  })
}

// CALENDAR
window.addEvent = async function() {
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
  const { data } = await supabase.from("events")
    .select("*").eq("household_id", householdId)

  document.getElementById("events").innerHTML =
    data.map(e => `<div>${e.title} - ${e.event_date}</div>`).join("")
}

// MORTGAGE
window.saveMortgage = async function() {
  const loan = parseFloat(document.getElementById("loan").value)
  const years = parseInt(document.getElementById("years").value)
  const margin = parseFloat(document.getElementById("margin").value)

  await supabase.from("mortgage").upsert({
    household_id: householdId,
    total_loan: loan,
    remaining_loan: loan,
    loan_years: years,
    margin
  })

  updateMortgage()
}

async function updateMortgage() {
  const { data } = await supabase.from("mortgage")
    .select("*").eq("household_id", householdId).single()

  if (!data) return

  const rate = data.margin + data.euribor_rate
  document.getElementById("mortgageInfo").innerText =
    `Rate ${rate}%`
}

// AI
async function generateInsights() {
  document.getElementById("insights").innerText =
    "You are on track. Consider increasing savings."
}

// MASTER
async function updateAll() {
  await updateDashboard()
  await updateMortgage()
  await generateInsights()
}

// INIT
init()