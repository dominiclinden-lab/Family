import { supabase } from "./supabase.js"

let householdId = null

// INIT
async function init() {
  const { data: user } = await supabase.auth.getUser()

  if (!user.user) {
    const email = prompt("Enter email")
    await supabase.auth.signInWithOtp({ email })
    alert("Check email")
    return
  }

  // CHECK HOUSEHOLD
  const { data } = await supabase
    .from("household_members")
    .select("*")
    .eq("user_id", user.user.id)

  if (!data.length) {
    document.getElementById("onboarding").classList.remove("hidden")
    return
  }

  householdId = data[0].household_id

  startApp()
}

// START APP
function startApp() {
  document.getElementById("app").classList.remove("hidden")
  loadAll()
}

// CREATE HOUSEHOLD
window.createHousehold = async function() {
  const name = document.getElementById("householdName").value

  const { data } = await supabase
    .from("households")
    .insert({ name })
    .select()
    .single()

  const user = (await supabase.auth.getUser()).data.user

  await supabase.from("household_members").insert({
    household_id: data.id,
    user_id: user.id
  })

  location.reload()
}

// INVITE
window.invite = async function() {
  const email = document.getElementById("inviteEmail").value
  await supabase.auth.signInWithOtp({ email })
  alert("Invite sent")
}

// DASHBOARD
async function updateDashboard() {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)

  let income = 0, expense = 0

  data.forEach(t => {
    if (t.type === "income") income += t.amount
    else expense += t.amount
  })

  const net = income - expense

  document.getElementById("netWorth").innerText = "€" + net
  document.getElementById("cashFlow").innerText = net

  document.getElementById("health").innerText =
    net > 0 ? "🟢 Strong" : "🔴 Risk"

  removeSkeleton()
}

// REMOVE LOADING
function removeSkeleton() {
  document.querySelectorAll(".skeleton")
    .forEach(el => el.classList.remove("skeleton"))
}

// LOAD ALL
async function loadAll() {
  await updateDashboard()
}

// NAV
window.switchTab = function(tab, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"))
  document.getElementById(tab).classList.add("active")

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"))
  el.classList.add("active")
}

init()