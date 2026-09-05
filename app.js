let products=[],mode="diamonds",chosen=null,verifiedPlayer=null,verificationToken=null,settings={};

const $=id=>document.getElementById(id);
async function api(url,opt={}){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Request failed");return d}
async function init(){try{const [p,s]=await Promise.all([api("/api/products"),api("/api/settings")]);products=p.products;settings=s;document.querySelectorAll("#brandName,#footerName").forEach(x=>x.textContent=settings.storeName||"Free Fire Top Up")}catch(e){toast(e.message)}renderProducts()}
function renderProducts(){const list=products.filter(p=>p.mode===mode&&p.active!==false);$("products").innerHTML=list.length?list.map(p=>`
<article class="product"><span class="badge ${p.badge==="HOT"?"hot":""} ${!p.badge?"hidden":""}">${esc(p.badge)}</span>
<div class="product-img">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:(p.mode==="diamonds"?"💎":"🎟️")}</div>
<h3>${esc(p.name)}</h3><div class="bonus">${esc(p.bonus||"")}</div><div class="stock">${Number(p.stock)>0?"● "+Number(p.stock)+" in stock":"● Out of stock"}</div>
<div class="price-row"><span class="price">₹${Number(p.price).toFixed(0)}</span>${p.mrp?`<span class="mrp">₹${Number(p.mrp).toFixed(0)}</span>`:""}<button class="buy ${Number(p.stock)<=0?"sold":""}" ${Number(p.stock)<=0?"disabled":""} onclick="buy('${esc(p.id)}')">${Number(p.stock)>0?"Buy →":"Sold out"}</button></div></article>`).join(""):`<p>No products available in this category.</p>`}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");mode=b.dataset.mode;renderProducts()}));
$("uid").addEventListener("input",e=>e.target.value=e.target.value.replace(/\D/g,"").slice(0,10));
$("check").addEventListener("click",verify);
async function verify(){const uid=$("uid").value.trim(),region=$("region").value;if(!/^\d{10}$/.test(uid)){ $("uidStatus").textContent="Enter a valid 10-digit UID.";return}
$("check").disabled=true;$("uidStatus").textContent="Verifying UID… Please wait.";
try{const d=await api("/api/verify-uid",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uid,region})});verifiedPlayer=d.player;verificationToken=d.verificationToken;
$("playerName").textContent=d.player.name;$("pLevel").textContent=d.player.level??"—";$("pRegion").textContent=String(d.player.region||region).toUpperCase();$("pLikes").textContent=Number(d.player.likes||0).toLocaleString();$("pUid").textContent=d.player.uid;
$("uidStatus").textContent="UID verified successfully.";openModal("verifyModal")}catch(e){verifiedPlayer=null;verificationToken=null;$("uidStatus").textContent=e.message}finally{$("check").disabled=false}}
function proceedStore(){closeModal("verifyModal");$("store").scrollIntoView({behavior:"smooth"});$("playerBar").classList.remove("hidden");$("playerBar").innerHTML=`<span>🎮 <b>${esc(verifiedPlayer.name)}</b><br><small>UID ${esc(verifiedPlayer.uid)} • Lvl ${esc(verifiedPlayer.level??"—")}</small></span><b class="verified">✓ Verified</b>`}
function buy(id){if(!verifiedPlayer){toast("Verify your UID first.");$("verify").scrollIntoView({behavior:"smooth"});return}chosen=products.find(p=>p.id===id);if(!chosen)return;$("cAccount").textContent=verifiedPlayer.name;$("cUid").textContent=verifiedPlayer.uid;$("cItem").textContent=chosen.name;$("cTotal").textContent=`₹${Number(chosen.price).toFixed(2)}`;openModal("confirmModal")}
async function createOrder(){try{const d=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:chosen.id,verificationToken})});closeModal("confirmModal");showQr(d.order)}catch(e){toast(e.message)}}
function showQr(order){$("qrAmount").textContent=`₹${Number(order.amount).toFixed(2)}`;$("qAccount").textContent=order.account;$("qUid").textContent=order.uid;$("qItem").textContent=order.product;$("qOrder").textContent=order.id;
$("qrBox").innerHTML=settings.qrUrl?`<img src="${esc(settings.qrUrl)}" alt="Payment QR">`:(settings.upiId?`<div><b>UPI ID</b><br><br>${esc(settings.upiId)}<br><small>Use your UPI app to pay the exact amount.</small></div>`:"<div id='qrEmpty'>QR code is not configured yet. Please contact the store.</div>");openModal("qrModal")}
function markPaid(){closeModal("qrModal");toast("Payment marked as submitted. The administrator will verify it.");}
function openModal(id){$(id).classList.remove("hidden")}function closeModal(id){$(id).classList.add("hidden")}
function toggleFaq(b){b.classList.toggle("open");b.querySelector("b").textContent=b.classList.contains("open")?"−":"+"}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),3000)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
init();
