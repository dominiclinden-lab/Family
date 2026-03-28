import { supabase } from "./supabase.js"

const input = document.getElementById("input")
const messages = document.getElementById("messages")

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const text = input.value
    input.value = ""

    messages.innerHTML += `<div>${text}</div>`

    const parsed = parseInput(text)

    if (parsed) {
      await supabase.from("transactions").insert(parsed)
    }

    updateAll()
  }
})

function parseInput(text) {
  text = text.toLowerCase()

  const amountMatch = text.match(/\d+/)
  if (!amountMatch) return null

  const amount = parseFloat(amountMatch[0])

  if (text.includes("spent")) {
    return {
      type: "expense",
      amount,
      category: detectCategory(text),
      currency: text.includes("eur") ? "EUR" : "SEK"
    }
  }

  if (text.includes("salary") || text.includes("income")) {
    return {
      type: "income",
      amount,
      category: "salary",
      currency: text.includes("eur") ? "EUR" : "SEK"
    }
  }

  if (text.includes("mortgage")) {
    return {
      type: "mortgage_payment",
      amount,
      category: "housing",
      currency: "SEK"
    }
  }

  return null
}

function detectCategory(text) {
  if (text.includes("food")) return "food"
  if (text.includes("transport")) return "transport"
  return "general"
}

async function updateAll() {
  await updateDashboard()
  await updateMortgage()
  await generateInsights()
}

async function updateDashboard() {
  const { data } = await supabase.from("transactions").select("*")

  let total = 0

  data.forEach(t => {
    total += t.type === "income" ? t.amount : -t.amount
  })

  document.getElementById("health").innerText =
    total > 0 ? "🟢 Strong" : "🔴 Risk"

  new Chart(document.getElementById("netChart"), {
    type: "line",
    data: {
      labels: data.map(d => new Date(d.created_at).toLocaleDateString()),
      datasets: [{ data: data.map((_, i) => total) }]
    }
  })
}

async function updateMortgage() {
  const { data } = await supabase.from("mortgage").select("*").single()

  const rate = data.euribor_rate + data.margin

  document.getElementById("mortgageInfo").innerText =
    `Rate: ${rate.toFixed(2)}%`

  document.getElementById("euribor").innerText =
    `${data.euribor_rate.toFixed(2)}%`
}

async function updateEuribor() {
  const res = await fetch("https://api.api-ninjas.com/v1/euribor", {
    headers: { "X-Api-Key": "YOUR_API_KEY" }
  })

  const data = await res.json()

  await supabase.from("mortgage").update({
    euribor_rate: data.rate,
    last_updated: new Date()
  })
}

async function generateInsights() {
  const { data } = await supabase.from("transactions").select("*")

  let income = 0
  let expense = 0

  data.forEach(t => {
    if (t.type === "income") income += t.amount
    else expense += t.amount
  })

  let insights = []

  if (expense > income) {
    insights.push("⚠️ Spending exceeds income")
  }

  if (income - expense > 5000) {
    insights.push("💡 You can increase savings")
  }

  document.getElementById("insights").innerHTML =
    insights.map(i => `<div>${i}</div>`).join("")
}

updateAll()
updateEuribor()