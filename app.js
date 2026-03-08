/* =============================================================================
   1. CONSTANTES ET CONFIGURATION
   ============================================================================= */

/* ---- Ordre d'affichage des filtres ---- */
const ORDRE_TYPES = [
  "Vidéo / Film", "Site internet / Blog", "Article / Livre",
  "Podcast", "Conférence", "Applis", "Réseaux sociaux", "Infographie", "Autre"
];
const TROUBLES_ACCOMPAGNES = [
  "Bipolarité", "Schizophrénie", "Trouble schizo-affectif", "Borderline / TPL"
];
const TROUBLES_COMORBIDITES = [
  "Dépression", "Anxiété/Angoisse", "Addictions", "Autres troubles"
];
const TROUBLES_NEURODIV = [
  "TCA", "TDAH adulte", "TSPT / PTSD", "TSA / autisme"
];
const THEMATIQUES_TRANSVERSALES = [
  "Deuil et perte", "Troubles du sommeil", "Santé mentale & précarité"
];
const ETRE_ACCOMPAGNE = [
  "Proches aidants"
];
const ORDRE_TROUBLES = [...TROUBLES_ACCOMPAGNES, ...TROUBLES_COMORBIDITES, ...TROUBLES_NEURODIV, ...THEMATIQUES_TRANSVERSALES, ...ETRE_ACCOMPAGNE];

const TITRES_EPINGLES = [
  "Troubles psychiques : lignes d\u2019\u00e9coute pour trouver de l\u2019aide",
  "Fil sant\u00e9 Jeunes : site d\u2019informations sur la sant\u00e9 mentale, l\u2019amour, la sexualit\u00e9 pour les jeunes de 12 \u00e0 25 ans et une ligne d\u2019\u00e9coute : 0 800 235 236",
  "Psycom : un site de ressources sur la sant\u00e9 mentale",
  "Premiers Secours en Sant\u00e9 Mentale",
  "5 mots pour mieux comprendre les troubles psys",
];

const PAGE_SIZE = 24;
const FAVORIS_KEY = "wikip-favoris";
const THEME_KEY = 'wikip-theme';
const ONBOARDING_KEY = "wikip-onboarding-vu";
const TAILLES = { moins: "14px", normal: "16px", plus: "19px" };

/* =============================================================================
   2. ÉTAT DE L'APPLICATION
   ============================================================================= */

let catActive = "tout";
let typeActif = null;
let troubleActif = null;
let recherche = "";
let pageActuelle = 1;
let favoris = new Set(JSON.parse(localStorage.getItem(FAVORIS_KEY) || "[]"));
let vueActive = localStorage.getItem("wikip-vue") || "grille";
let debounceTimer;
let toastTimer = null;

/* =============================================================================
   3. RÉFÉRENCES DOM
   ============================================================================= */

const grille          = document.getElementById("grille");
const grilleEdito     = document.getElementById("grille-edito");
const sectionEdito    = document.getElementById("section-edito");
const compteur        = document.getElementById("compteur");
const inputRecherche  = document.getElementById("recherche");
const zoneSections    = document.getElementById("filtres-sections");
const zoneTypes       = document.getElementById("filtres-types");
const zoneTroubles    = document.getElementById("filtres-troubles");
const resultatsLabel  = document.getElementById("resultats-label");
const btnEffacer      = document.getElementById("btn-effacer");
const btnClearRecherche = document.getElementById("btn-clear-recherche");
const btnMoins        = document.getElementById("btn-police-moins");
const btnNormal       = document.getElementById("btn-police-normal");
const btnPlus         = document.getElementById("btn-police-plus");
const btnEspacement   = document.getElementById("btn-espacement");
const btnTheme        = document.getElementById('theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');
const btnRetourHaut   = document.getElementById("btn-retour-haut");

/* =============================================================================
   4. DONNÉES : aplatissement et filtrage
   ============================================================================= */

const _tousLesItemsCache = (() => {
  const items = [];
  data.forEach(section => {
    section.items.forEach(item => {
      items.push({ ...item, cat: section.id, labelSection: section.label });
    });
  });
  return items;
})();
function tousLesItems() { return _tousLesItemsCache; }

function itemsFiltres() {
  const terme = recherche.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tousLesItems().filter(item => {
    if (catActive === "favoris" && !favoris.has(item.id)) return false;
    if (catActive !== "tout" && catActive !== "favoris" && item.cat !== catActive) return false;
    if (typeActif && item.type !== typeActif) return false;
    if (troubleActif && !item.troubles.includes(troubleActif)) return false;
    if (terme) {
      const haystack = (item.title + " " + item.desc + " " + item.type + " " + item.troubles.join(" "))
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (!haystack.includes(terme)) return false;
    }
    return true;
  });
}

/* =============================================================================
   5. FAVORIS
   ============================================================================= */

function toggleFavori(id) {
  if (favoris.has(id)) favoris.delete(id);
  else favoris.add(id);
  localStorage.setItem(FAVORIS_KEY, JSON.stringify([...favoris]));
}

function mettreAJourBadgeFavoris() {
  const tabFavoris = document.querySelector(".tab-section[data-cat='favoris']");
  if (!tabFavoris) return;
  let badge = tabFavoris.querySelector(".favori-badge");
  if (favoris.size === 0) {
    if (badge) badge.remove();
  } else {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "favori-badge";
      tabFavoris.appendChild(badge);
    }
    badge.textContent = favoris.size;
  }
}

function afficherToast(msg) {
  const toast = document.getElementById("toast-favori");
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2000);
}

/* =============================================================================
   6. RENDU DES CARTES
   ============================================================================= */

function typeVersColor(type) {
  if (!type) return "autre";
  const t = type.toLowerCase();
  if (t.includes("vid")) return "video";
  if (t.includes("site") || t.includes("blog")) return "site";
  if (t.includes("article") || t.includes("livre")) return "article";
  if (t.includes("podcast")) return "podcast";
  if (t.includes("conf")) return "conference";
  if (t.includes("appli")) return "applis";
  if (t.includes("réseaux") || t.includes("sociaux")) return "reseaux";
  if (t.includes("infographie")) return "infographie";
  return "autre";
}

function rendreCarte(item) {
  const li = document.createElement("li");
  li.style.listStyle = "none";
  const div = document.createElement("article");
  div.className = "carte";

  const bande = document.createElement("div");
  bande.className = "carte-type-bande";
  bande.setAttribute("data-type-color", typeVersColor(item.type));
  bande.setAttribute("aria-hidden", "true");
  div.appendChild(bande);

  const corps = document.createElement("div");
  corps.className = "carte-corps";

  const icone = document.createElement("div");
  icone.className = "carte-icone";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = item.icon || "📌";

  const contenu = document.createElement("div");
  contenu.className = "carte-contenu";

  const titre = document.createElement("h3");
  titre.className = "carte-titre";
  titre.textContent = item.title;

  const desc = document.createElement("p");
  desc.className = "carte-desc";
  const descId = "desc-" + item.id;
  desc.id = descId;
  desc.textContent = item.desc;

  contenu.appendChild(titre);
  contenu.appendChild(desc);

  if (item.desc && item.desc.length > 200) {
    const btnLire = document.createElement("button");
    btnLire.className = "btn-lire-plus";
    btnLire.textContent = "Lire plus";
    btnLire.setAttribute("aria-expanded", "false");
    btnLire.setAttribute("aria-controls", descId);
    btnLire.addEventListener("click", () => {
      const etendu = desc.classList.toggle("etendu");
      btnLire.textContent = etendu ? "Lire moins" : "Lire plus";
      btnLire.setAttribute("aria-expanded", etendu ? "true" : "false");
    });
    contenu.appendChild(btnLire);
  }
  corps.appendChild(icone);
  corps.appendChild(contenu);
  div.appendChild(corps);

  {
    const tagsZone = document.createElement("div");
    tagsZone.className = "carte-tags";
    if (item.type && item.type.trim()) {
      const pillType = document.createElement("button");
      pillType.className = "carte-tag";
      pillType.setAttribute("tabindex", "-1");
      pillType.textContent = item.type;
      pillType.setAttribute("aria-label", `Filtrer par type : ${item.type}`);
      pillType.title = `Filtrer par type : ${item.type}`;
      pillType.addEventListener("click", e => { e.preventDefault(); activerFiltreTag(item.type, true); });
      tagsZone.appendChild(pillType);
    }
    item.troubles.forEach(t => {
      if (!t || !t.trim()) return;
      const pill = document.createElement("button");
      pill.className = "carte-tag";
      pill.setAttribute("tabindex", "-1");
      pill.textContent = t;
      pill.setAttribute("aria-label", `Filtrer par trouble : ${t}`);
      pill.title = `Filtrer par trouble : ${t}`;
      pill.addEventListener("click", e => { e.preventDefault(); activerFiltreTag(t, false); });
      tagsZone.appendChild(pill);
    });
    const totalTags = 1 + item.troubles.length;
    if (totalTags > 3) {
      const allTags = [item.type, ...item.troubles];
      const hiddenTags = allTags.slice(3).join(", ");
      const more = document.createElement("span");
      more.className = "carte-tag-more";
      more.textContent = `+${totalTags - 3}`;
      more.setAttribute("data-tooltip", hiddenTags);
      more.setAttribute("aria-label", `${totalTags - 3} tags masqués : ${hiddenTags}`);
      tagsZone.appendChild(more);
    }
    div.appendChild(tagsZone);
  }

  const lienBloc = document.createElement("div");
  lienBloc.className = "carte-lien-bloc";
  lienBloc.style.display = "flex";
  lienBloc.style.alignItems = "center";
  lienBloc.style.justifyContent = "space-between";
  if (item.link) {
    const lien = document.createElement("a");
    lien.className = "carte-lien";
    lien.href = item.link;
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    lien.textContent = "Voir la ressource →";
    lien.setAttribute("aria-label", `Voir la ressource : ${item.title} (s'ouvre dans un nouvel onglet)`);
    lienBloc.appendChild(lien);
  } else {
    const indispo = document.createElement("span");
    indispo.className = "carte-lien-indispo";
    indispo.textContent = "Lien bientôt disponible";
    lienBloc.appendChild(indispo);
  }
  const btnFavori = document.createElement("button");
  btnFavori.className = "btn-favori" + (favoris.has(item.id) ? " actif" : "");
  btnFavori.textContent = favoris.has(item.id) ? "♥" : "♡";
  btnFavori.setAttribute("aria-label", `${favoris.has(item.id) ? "Retirer des" : "Ajouter aux"} favoris : ${item.title}`);
  btnFavori.setAttribute("aria-pressed", favoris.has(item.id) ? "true" : "false");
  btnFavori.addEventListener("click", () => {
    toggleFavori(item.id);
    const estFavori = favoris.has(item.id);
    btnFavori.textContent = estFavori ? "♥" : "♡";
    btnFavori.classList.toggle("actif", estFavori);
    btnFavori.setAttribute("aria-label", `${estFavori ? "Retirer des" : "Ajouter aux"} favoris : ${item.title}`);
    btnFavori.setAttribute("aria-pressed", estFavori ? "true" : "false");
    btnFavori.classList.remove("pulse");
    void btnFavori.offsetWidth;
    btnFavori.classList.add("pulse");
    afficherToast(estFavori ? "Ajouté aux favoris" : "Retiré des favoris");
    mettreAJourBadgeFavoris();
    if (catActive === "favoris") mettreAJourGrille();
  });
  lienBloc.appendChild(btnFavori);
  div.appendChild(lienBloc);

  li.appendChild(div);
  return li;
}

/* =============================================================================
   7. PAGINATION
   ============================================================================= */

function afficherPage(items, page) {
  const ancienBtnVoirPlus = document.getElementById("btn-voir-plus");
  if (ancienBtnVoirPlus) ancienBtnVoirPlus.remove();

  const debut = (page - 1) * PAGE_SIZE;
  const fin = page * PAGE_SIZE;
  const tranche = items.slice(debut, fin);

  const frag = document.createDocumentFragment();
  const premierNouveau = tranche.length > 0 ? rendreCarte(tranche[0]) : null;
  if (premierNouveau) frag.appendChild(premierNouveau);
  tranche.slice(1).forEach(item => frag.appendChild(rendreCarte(item)));
  grille.appendChild(frag);

  if (page > 1 && premierNouveau) {
    const h3 = premierNouveau.querySelector("h3");
    if (h3) { h3.setAttribute("tabindex", "-1"); h3.focus(); }
  }

  if (fin < items.length) {
    const btnVoirPlus = document.createElement("button");
    btnVoirPlus.id = "btn-voir-plus";
    btnVoirPlus.className = "btn-voir-plus";
    const restant = items.length - fin;
    btnVoirPlus.textContent = `Voir ${Math.min(restant, PAGE_SIZE)} ressources de plus (${restant} restantes sur ${items.length})`;
    btnVoirPlus.addEventListener("click", () => {
      pageActuelle++;
      afficherPage(itemsFiltres(), pageActuelle);
    });
    grille.insertAdjacentElement("afterend", btnVoirPlus);
  }

  const barreWrap = document.getElementById("barre-progression-wrap");
  const chargees = Math.min(fin, items.length);
  if (items.length > PAGE_SIZE) {
    barreWrap.classList.add("visible");
    document.getElementById("barre-progression-fill").style.width = `${(chargees / items.length) * 100}%`;
    document.getElementById("barre-progression-texte").textContent = `${chargees} / ${items.length} chargées`;
  } else {
    barreWrap.classList.remove("visible");
  }
}

/* =============================================================================
   8. GRILLE : mise à jour principale
   ============================================================================= */

function mettreAJourGrille() {
  const items = itemsFiltres();
  pageActuelle = 1;
  grille.innerHTML = "";

  const filtreActif = catActive !== "tout" || typeActif !== null || troubleActif !== null || recherche.trim() !== "";
  const masquerEdito = typeActif !== null || troubleActif !== null || recherche.trim() !== "" || catActive === "favoris";
  sectionEdito.style.display = masquerEdito ? "none" : "";

  const panelAffiner = document.getElementById("filtres-avances");
  const btnAffiner = document.getElementById("btn-affiner");
  if (panelAffiner && btnAffiner && typeActif !== null && panelAffiner.hidden) {
    panelAffiner.hidden = false;
    btnAffiner.setAttribute("aria-expanded", "true");
  }

  if (btnEffacer) {
    btnEffacer.classList.toggle("visible", filtreActif);
  }

  if (items.length === 0) {
    const vide = document.createElement("div");
    vide.className = "etat-vide";
    vide.setAttribute("role", "status");
    if (catActive === "favoris") {
      vide.innerHTML = `
        <span class="etat-vide-emoji">♡</span>
        <p class="etat-vide-titre">Pas encore de favoris</p>
        <p class="etat-vide-msg">Ajoute ♡ sur les ressources qui t'intéressent pour les retrouver ici.</p>
      `;
    } else {
      vide.innerHTML = `
        <span class="etat-vide-emoji">🌿</span>
        <p class="etat-vide-titre">Aucune ressource trouvée</p>
        <p class="etat-vide-msg">Essaie d'élargir les filtres ou d'effacer ta recherche&nbsp;—<br>il y a forcément quelque chose pour toi ici.</p>
      `;
    }
    grille.appendChild(vide);
    const ancienBtn = document.getElementById("btn-voir-plus");
    if (ancienBtn) ancienBtn.remove();
    document.getElementById("barre-progression-wrap").classList.remove("visible");
  } else {
    afficherPage(items, pageActuelle);
  }

  const partageWrap = document.getElementById("partage-wrap");
  if (catActive === "favoris" && items.length > 0) {
    partageWrap.style.display = "";
    partageWrap.innerHTML = "";
    const btnPartager = document.createElement("button");
    btnPartager.className = "btn-partager-favoris";
    btnPartager.innerHTML = "🔗 Partager ma sélection";
    btnPartager.setAttribute("aria-label", "Copier un lien vers mes favoris");
    btnPartager.addEventListener("click", () => {
      const ids = [...favoris].join(",");
      const url = `${location.origin}${location.pathname}?favoris=${encodeURIComponent(ids)}`;
      navigator.clipboard.writeText(url).then(() => {
        btnPartager.innerHTML = "✓ Lien copié !";
        btnPartager.classList.add("copie");
        setTimeout(() => {
          btnPartager.innerHTML = "🔗 Partager ma sélection";
          btnPartager.classList.remove("copie");
        }, 2500);
      }).catch(() => {
        prompt("Copie ce lien :", url);
      });
    });
    partageWrap.appendChild(btnPartager);
  } else {
    partageWrap.style.display = "none";
  }

  const total = tousLesItems().length;
  if (filtreActif) {
    compteur.textContent = `${items.length} / ${total} ressources`;
  } else {
    compteur.textContent = `${total} ressources`;
  }
  compteur.style.display = "";

  resultatsLabel.textContent = "";
  resultatsLabel.classList.remove("vide");

  const partiesFiltres = [];
  if (catActive !== "tout") {
    const tabBtn = document.querySelector(`.tab-section[data-cat="${catActive}"]`);
    if (tabBtn) partiesFiltres.push(tabBtn.textContent.trim());
  }
  if (typeActif) partiesFiltres.push(typeActif);
  if (troubleActif) partiesFiltres.push(troubleActif);
  if (recherche.trim()) partiesFiltres.push(`"${recherche.trim()}"`);
  document.title = partiesFiltres.length > 0
    ? `${partiesFiltres.join(" · ")} — WikiPerché`
    : "WikiPerché — par La Maison Perchée";

  mettreAJourResumeFiltres();
  syncURL();
}

function mettreAJourResumeFiltres() {
  const resume = document.getElementById("filtres-resume");
  resume.innerHTML = "";
  if (typeActif) {
    const chip = document.createElement("button");
    chip.className = "chip-resume";
    chip.setAttribute("aria-label", `Retirer le filtre ${typeActif}`);
    chip.innerHTML = `${typeActif} <span class="chip-resume-x" aria-hidden="true">✕</span>`;
    chip.addEventListener("click", () => { activerFiltreTag(typeActif, true); });
    resume.appendChild(chip);
  }
}

/* =============================================================================
   9. FILTRES : construction et logique
   ============================================================================= */

function activerFiltreTag(valeur, estType) {
  if (estType) {
    typeActif = typeActif === valeur ? null : valeur;
    zoneTypes.querySelectorAll(".chip-type").forEach(c => {
      const match = c.dataset.type === typeActif;
      c.classList.toggle("actif", match);
      c.setAttribute("aria-pressed", match ? "true" : "false");
    });
  } else {
    troubleActif = troubleActif === valeur ? null : valeur;
    zoneTroubles.querySelectorAll(".chip-trouble").forEach(c => {
      const match = c.dataset.trouble === troubleActif;
      c.classList.toggle("actif", match);
      c.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  if (estType) {
    const panelAffiner = document.getElementById("filtres-avances");
    const btnAffiner = document.getElementById("btn-affiner");
    if (panelAffiner && panelAffiner.hidden) {
      panelAffiner.hidden = false;
      btnAffiner.setAttribute("aria-expanded", "true");
    }
  }
  mettreAJourGrille();
}

function construireFiltresSections() {
  zoneSections.innerHTML = "";

  const btnTout = document.createElement("button");
  btnTout.className = "tab-section actif";
  btnTout.textContent = "Toutes les ressources";
  btnTout.dataset.cat = "tout";
  btnTout.setAttribute("aria-pressed", "true");
  zoneSections.appendChild(btnTout);

  data.forEach(section => {
    const btn = document.createElement("button");
    btn.className = "tab-section";
    btn.textContent = section.label;
    btn.dataset.cat = section.id;
    btn.setAttribute("aria-pressed", "false");
    zoneSections.appendChild(btn);
  });

  const btnFavoris = document.createElement("button");
  btnFavoris.className = "tab-section";
  btnFavoris.dataset.cat = "favoris";
  btnFavoris.setAttribute("aria-pressed", "false");
  btnFavoris.innerHTML = "♥ Mes favoris";
  zoneSections.appendChild(btnFavoris);

  zoneSections.addEventListener("click", e => {
    const btn = e.target.closest(".tab-section");
    if (!btn) return;
    catActive = btn.dataset.cat;
    zoneSections.querySelectorAll(".tab-section").forEach(b => {
      b.classList.toggle("actif", b === btn);
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    mettreAJourGrille();
  });
}

function construireFiltresTypes() {
  const label = zoneTypes.querySelector(".filtre-label");
  zoneTypes.innerHTML = "";
  if (label) zoneTypes.appendChild(label);

  const typesDansData = new Set();
  tousLesItems().forEach(item => {
    if (item.type) typesDansData.add(item.type);
  });

  ORDRE_TYPES.forEach(type => {
    if (!typesDansData.has(type)) return;
    const chip = document.createElement("button");
    chip.className = "chip chip-type";
    chip.textContent = type;
    chip.dataset.type = type;
    chip.setAttribute("aria-pressed", "false");
    zoneTypes.appendChild(chip);
  });

  zoneTypes.addEventListener("click", e => {
    const chip = e.target.closest(".chip-type");
    if (!chip) return;
    if (typeActif === chip.dataset.type) {
      typeActif = null;
      chip.classList.remove("actif");
      chip.setAttribute("aria-pressed", "false");
    } else {
      typeActif = chip.dataset.type;
      zoneTypes.querySelectorAll(".chip-type").forEach(c => {
        c.classList.toggle("actif", c === chip);
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      });
    }
    mettreAJourGrille();
  });
}

function construireFiltresTroubles() {
  zoneTroubles.innerHTML = "";

  const troublesDansData = new Set();
  tousLesItems().forEach(item => {
    item.troubles.forEach(t => troublesDansData.add(t));
  });

  const LABELS_COURTS = { "Trouble schizo-affectif": "Schizo-affectif" };

  const wrapper = document.createElement("div");
  wrapper.className = "filtres-troubles-groupes";

  const groupes = [
    { label: "Troubles accompagnés", troubles: TROUBLES_ACCOMPAGNES },
    { label: "Être accompagné", troubles: ETRE_ACCOMPAGNE },
    { label: "Comorbidités fréquentes", troubles: TROUBLES_COMORBIDITES },
    { label: "Neurodiversité & autres troubles", troubles: TROUBLES_NEURODIV },
    { label: "Thématiques transversales", troubles: THEMATIQUES_TRANSVERSALES }
  ];

  groupes.forEach(({ label: groupeLabel, troubles }) => {
    const filtres = troubles.filter(t => troublesDansData.has(t));
    if (filtres.length === 0) return;

    const groupe = document.createElement("div");
    groupe.className = "filtres-groupe ouvert";

    const lbl = document.createElement("button");
    lbl.className = "filtres-groupe-label";
    lbl.type = "button";
    lbl.textContent = groupeLabel;
    lbl.setAttribute("aria-expanded", "true");
    lbl.addEventListener("click", () => {
      const ouvert = groupe.classList.toggle("ouvert");
      lbl.setAttribute("aria-expanded", String(ouvert));
    });
    groupe.appendChild(lbl);

    const chipsRow = document.createElement("div");
    chipsRow.className = "chips-troubles-groupe";
    const groupeId = "groupe-" + groupeLabel.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, "-").replace(/-+$/, "");
    chipsRow.id = groupeId;
    chipsRow.setAttribute("role", "group");
    chipsRow.setAttribute("aria-label", groupeLabel);
    lbl.setAttribute("aria-controls", groupeId);

    filtres.forEach(trouble => {
      const chip = document.createElement("button");
      chip.className = "chip chip-trouble";
      chip.textContent = LABELS_COURTS[trouble] || trouble;
      chip.dataset.trouble = trouble;
      chip.setAttribute("aria-pressed", "false");
      chipsRow.appendChild(chip);
    });

    groupe.appendChild(chipsRow);
    wrapper.appendChild(groupe);
  });

  zoneTroubles.appendChild(wrapper);

  zoneTroubles.addEventListener("click", e => {
    const chip = e.target.closest(".chip-trouble");
    if (!chip) return;
    if (troubleActif === chip.dataset.trouble) {
      troubleActif = null;
      chip.classList.remove("actif");
      chip.setAttribute("aria-pressed", "false");
    } else {
      troubleActif = chip.dataset.trouble;
      zoneTroubles.querySelectorAll(".chip-trouble").forEach(c => {
        c.classList.toggle("actif", c === chip);
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      });
    }
    mettreAJourGrille();
  });
}

function toutEffacer() {
  catActive = "tout";
  typeActif = null;
  troubleActif = null;
  recherche = "";
  inputRecherche.value = "";
  zoneSections.querySelectorAll(".tab-section").forEach(b => {
    const isAll = b.dataset.cat === "tout";
    b.classList.toggle("actif", isAll);
    b.setAttribute("aria-pressed", isAll ? "true" : "false");
  });
  zoneTypes.querySelectorAll(".chip-type").forEach(c => {
    c.classList.remove("actif");
    c.setAttribute("aria-pressed", "false");
  });
  zoneTroubles.querySelectorAll(".chip-trouble").forEach(c => {
    c.classList.remove("actif");
    c.setAttribute("aria-pressed", "false");
  });
  mettreAJourGrille();
}

/* =============================================================================
   10. ROUTING : synchronisation URL ↔ état
   ============================================================================= */

function syncURL() {
  const params = new URLSearchParams();
  if (catActive !== "tout") params.set("section", catActive);
  if (typeActif) params.set("type", typeActif);
  if (troubleActif) params.set("trouble", troubleActif);
  if (recherche.trim()) params.set("q", recherche.trim());
  const nouvelleURL = params.toString()
    ? `${location.pathname}?${params}`
    : location.pathname;
  history.replaceState(null, "", nouvelleURL);
}

function lireURL() {
  const params = new URLSearchParams(location.search);
  if (params.has("favoris")) {
    const ids = params.get("favoris").split(",").filter(s => s.length > 0);
    if (ids.length > 0) {
      ids.forEach(id => favoris.add(id));
      localStorage.setItem(FAVORIS_KEY, JSON.stringify([...favoris]));
      catActive = "favoris";
      mettreAJourBadgeFavoris();
    }
  }
  if (params.has("section")) catActive = params.get("section");
  if (params.has("type")) typeActif = params.get("type");
  if (params.has("trouble")) troubleActif = params.get("trouble");
  if (params.has("q")) {
    recherche = params.get("q");
    const inputRecherche = document.getElementById("recherche");
    if (inputRecherche) inputRecherche.value = recherche;
  }
  document.querySelectorAll(".tab-section").forEach(b => {
    const actif = b.dataset.cat === catActive;
    b.classList.toggle("actif", actif);
    b.setAttribute("aria-pressed", actif ? "true" : "false");
  });
  document.querySelectorAll(".chip-type").forEach(c => {
    const actif = c.dataset.type === typeActif;
    c.classList.toggle("actif", actif);
    c.setAttribute("aria-pressed", actif ? "true" : "false");
  });
  document.querySelectorAll(".chip-trouble").forEach(c => {
    const actif = c.dataset.trouble === troubleActif;
    c.classList.toggle("actif", actif);
    c.setAttribute("aria-pressed", actif ? "true" : "false");
  });
}

/* =============================================================================
   11. ACCESSIBILITÉ : taille de police, espacement, thème
   ============================================================================= */

function appliquerTaille(clé) {
  document.documentElement.style.fontSize = TAILLES[clé];
  [btnMoins, btnNormal, btnPlus].forEach(b => b.classList.remove("actif"));
  ({ moins: btnMoins, normal: btnNormal, plus: btnPlus })[clé].classList.add("actif");
  localStorage.setItem("wikip-fontsize", clé);
}

function appliquerEspacement(actif) {
  document.body.classList.toggle("dys-actif", actif);
  btnEspacement.classList.toggle("actif", actif);
  btnEspacement.setAttribute("aria-pressed", String(actif));
  localStorage.setItem("wikip-spacing", actif ? "1" : "0");
}

function themeEffectif() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function appliquerTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    btnTheme.childNodes[0].textContent = '☀️ ';
    themeToggleLabel.textContent = 'Clair';
    btnTheme.setAttribute('aria-label', 'Passer en mode clair');
  } else {
    btnTheme.childNodes[0].textContent = '🌙 ';
    themeToggleLabel.textContent = 'Sombre';
    btnTheme.setAttribute('aria-label', 'Passer en mode sombre');
  }
}

function appliquerVue(vue) {
  vueActive = vue;
  localStorage.setItem("wikip-vue", vue);
  grille.setAttribute("data-vue", vue);
  grilleEdito.setAttribute("data-vue", vue);
  const btnGrille = document.getElementById("btn-vue-grille");
  const btnListe  = document.getElementById("btn-vue-liste");
  btnGrille.classList.toggle("actif", vue === "grille");
  btnGrille.setAttribute("aria-pressed", vue === "grille" ? "true" : "false");
  btnListe.classList.toggle("actif", vue === "liste");
  btnListe.setAttribute("aria-pressed", vue === "liste" ? "true" : "false");
}

/* =============================================================================
   12. SECTION ÉDITORIALE
   ============================================================================= */

function construireEdito() {
  const tousItems = tousLesItems();
  const epingles = TITRES_EPINGLES
    .map(titre => tousItems.find(it => it.title.trim() === titre.trim()))
    .filter(Boolean);
  const frag = document.createDocumentFragment();
  epingles.forEach(item => frag.appendChild(rendreCarte(item)));
  grilleEdito.appendChild(frag);
}

/* =============================================================================
   13. INITIALISATION
   ============================================================================= */

function initToggleAccès() {
  const btn = document.getElementById("btn-accès-toggle");
  const panel = document.getElementById("barre-accès-panel");
  btn.addEventListener("click", () => {
    const ouvert = !panel.hidden;
    panel.hidden = ouvert;
    btn.setAttribute("aria-expanded", String(!ouvert));
    btn.classList.toggle("actif", !ouvert);
  });
}

function initToggleAffiner() {
  const btn = document.getElementById("btn-affiner");
  const panel = document.getElementById("filtres-avances");
  btn.addEventListener("click", () => {
    const ouvert = !panel.hidden;
    panel.hidden = ouvert;
    btn.setAttribute("aria-expanded", String(!ouvert));
  });
}

/* ---- Recherche live ---- */
function majClearBtn() { btnClearRecherche.style.display = inputRecherche.value ? "" : "none"; }
inputRecherche.addEventListener("input", () => {
  majClearBtn();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    recherche = inputRecherche.value;
    mettreAJourGrille();
  }, 150);
});
btnClearRecherche.addEventListener("click", () => {
  inputRecherche.value = "";
  recherche = "";
  majClearBtn();
  inputRecherche.focus();
  mettreAJourGrille();
});

/* ---- Taille de police ---- */
btnMoins.addEventListener("click",  () => appliquerTaille("moins"));
btnNormal.addEventListener("click", () => appliquerTaille("normal"));
btnPlus.addEventListener("click",   () => appliquerTaille("plus"));
const tailleStockée = localStorage.getItem("wikip-fontsize");
if (tailleStockée && TAILLES[tailleStockée]) appliquerTaille(tailleStockée);

/* ---- Espacement ---- */
btnEspacement.addEventListener("click", () => {
  appliquerEspacement(!document.body.classList.contains("dys-actif"));
});
if (localStorage.getItem("wikip-spacing") === "1") appliquerEspacement(true);

/* ---- Thème ---- */
appliquerTheme(themeEffectif());
btnTheme.addEventListener('click', () => {
  const actuel = document.documentElement.getAttribute('data-theme');
  const nouveau = actuel === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, nouveau);
  appliquerTheme(nouveau);
});

/* ---- Vue grille / liste ---- */
document.getElementById("btn-vue-grille").addEventListener("click", () => appliquerVue("grille"));
document.getElementById("btn-vue-liste").addEventListener("click", () => appliquerVue("liste"));

/* ---- Bootstrap ---- */
construireFiltresSections();
construireFiltresTypes();
construireFiltresTroubles();
construireEdito();
initToggleAccès();
initToggleAffiner();
btnEffacer.addEventListener("click", toutEffacer);
lireURL();
appliquerVue(vueActive);
mettreAJourBadgeFavoris();
mettreAJourGrille();

/* ---- Bandeau onboarding (première visite) ---- */
if (!localStorage.getItem(ONBOARDING_KEY) && !localStorage.getItem(FAVORIS_KEY)) {
  const bandeau = document.getElementById("bandeau-onboarding");
  bandeau.style.display = "";
  document.getElementById("bandeau-onboarding-close").addEventListener("click", () => {
    bandeau.style.display = "none";
    localStorage.setItem(ONBOARDING_KEY, "1");
  });
  const masquerOnboarding = () => {
    bandeau.style.display = "none";
    localStorage.setItem(ONBOARDING_KEY, "1");
  };
  document.querySelectorAll(".chip-trouble, .chip-type, .tab-section").forEach(el => {
    el.addEventListener("click", masquerOnboarding, { once: true });
  });
}

/* ---- Recherches fréquentes au focus ---- */
(function() {
  const input = document.getElementById("recherche");
  const panel = document.getElementById("recherches-rapides");
  const TOP_TROUBLES = ORDRE_TROUBLES.slice(0, 5);
  const label = document.createElement("span");
  label.className = "recherches-rapides-label";
  label.textContent = "Populaires :";
  panel.appendChild(label);
  TOP_TROUBLES.forEach(t => {
    const chip = document.createElement("button");
    chip.className = "chip-rapide";
    chip.setAttribute("role", "option");
    chip.setAttribute("aria-selected", "false");
    chip.textContent = t;
    chip.addEventListener("mousedown", e => {
      e.preventDefault();
      input.value = t;
      recherche = t;
      panel.classList.remove("visible");
      mettreAJourGrille();
    });
    panel.appendChild(chip);
  });
  input.addEventListener("focus", () => {
    if (!input.value.trim()) panel.classList.add("visible");
  });
  input.addEventListener("blur", () => {
    panel.classList.remove("visible");
  });
  input.addEventListener("input", () => {
    panel.classList.toggle("visible", !input.value.trim() && document.activeElement === input);
  });
  input.addEventListener("keydown", e => {
    if (!panel.classList.contains("visible")) return;
    const chips = [...panel.querySelectorAll(".chip-rapide")];
    if (!chips.length) return;
    const idx = chips.findIndex(c => c.getAttribute("aria-selected") === "true");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (idx + 1) % chips.length : (idx <= 0 ? chips.length - 1 : idx - 1);
      chips.forEach(c => c.setAttribute("aria-selected", "false"));
      chips[next].setAttribute("aria-selected", "true");
      chips[next].focus();
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      chips[idx].click();
    } else if (e.key === "Escape") {
      panel.classList.remove("visible");
    }
  });
})();

/* ---- Bouton retour en haut ---- */
window.addEventListener("scroll", () => {
  btnRetourHaut.classList.toggle("visible", window.scrollY > 400);
}, { passive: true });
btnRetourHaut.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---- Bandeau crise ---- */
(function() {
  const bandeau = document.getElementById("bandeau-crise");
  const CRISE_KEY = "wikip-crise-ferme";
  if (sessionStorage.getItem(CRISE_KEY)) {
    bandeau.style.display = "none";
    document.body.style.paddingBottom = "0";
  }
  document.getElementById("bandeau-crise-close").addEventListener("click", () => {
    bandeau.style.display = "none";
    document.body.style.paddingBottom = "0";
    sessionStorage.setItem(CRISE_KEY, "1");
  });
})();

/* ---- Indicateur scroll chips ---- */
document.querySelectorAll(".chips-barre-wrap").forEach(wrap => {
  const barre = wrap.querySelector(".chips-barre");
  if (!barre) return;
  const verifierScroll = () => {
    const atEnd = barre.scrollLeft + barre.clientWidth >= barre.scrollWidth - 8;
    wrap.classList.toggle("scrolled-end", atEnd);
  };
  barre.addEventListener("scroll", verifierScroll, { passive: true });
  verifierScroll();
});
