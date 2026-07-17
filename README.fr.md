<div align="center">

![new-api](/web/default/public/logo.png)

# NextRouter

🍥 **Un fork amélioré en publication roulante de [new-api](https://github.com/QuantumNous/new-api) — passerelle LLM + boucle d'agent côté navigateur**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <a href="./README.md">English</a> |
  <strong>Français</strong> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-AGPLv3-brightgreen" alt="licence">
  </a><!--
  --><a href="https://hub.docker.com/r/webagentloop/nextrouter">
    <img src="https://img.shields.io/badge/docker-webagentloop%2Fnextrouter-blue" alt="docker">
  </a><!--
  --><a href="https://github.com/QuantumNous/new-api">
    <img src="https://img.shields.io/badge/fork%20of-QuantumNous%2Fnew--api-orange" alt="fork de QuantumNous/new-api">
  </a>
</p>

<p align="center">
  <a href="#-quest-ce-que-nextrouter">À propos</a> •
  <a href="#-les-nouveautés-de-nextrouter">Nouveautés</a> •
  <a href="#-démarrage-rapide">Démarrage</a> •
  <a href="#-maintenance-suivi-de-lupstream">Maintenance</a> •
  <a href="#-licence">Licence</a>
</p>

</div>

> 🔄 **Mises à jour roulantes, suivi de l'amont.** NextRouter fusionne en continu le `main` de [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api). Le tag d'image roulant **`latest`** pointe vers la dernière version publiée avec succès (amont + modifications du fork) — un `docker pull` vous maintient à jour ; épinglez un tag versionné pour des déploiements reproductibles.

> [!IMPORTANT]
> - Ce projet est exclusivement destiné aux scénarios de passerelle API d'IA légalement autorisés, d'authentification organisationnelle, de gestion multi-modèles, d'analyse d'utilisation, de comptabilisation des coûts et de déploiement privé.
> - Les utilisateurs doivent obtenir légalement les clés API, comptes, services de modèles et autorisations d'interface en amont, et doivent respecter les conditions d'utilisation en amont et les lois et réglementations applicables.
> - Lors de la fourniture de services d'IA générative au public, les utilisateurs doivent se conformer aux exigences réglementaires applicables et remplir toutes les obligations d'enregistrement, de licence, de sécurité du contenu, de vérification d'identité, de conservation des journaux, de fiscalité et d'autorisation en amont requises par leur juridiction.

---

## 🧭 Qu'est-ce que NextRouter

**NextRouter** est un fork communautaire de [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api) qui suit de près la branche `main` amont. Il conserve tout ce que new-api propose — agrégation de plus de 40 fournisseurs d'IA en amont (OpenAI, Claude, Gemini, Azure, AWS Bedrock, …) derrière une API unifiée, ainsi que gestion des utilisateurs, facturation, limitation de débit et tableau de bord d'administration — et ajoute un ensemble ciblé d'améliorations de passerelle et d'interface (voir [Les nouveautés](#-les-nouveautés-de-nextrouter)).

Pour l'ensemble des fonctionnalités, la prise en charge des modèles, les formats d'API et la configuration, reportez-vous à la **documentation amont** : <https://docs.newapi.pro/en/docs>.

---

## 🌱 À propos de ce fork et de sa relation avec l'amont

NextRouter est **basé sur [`QuantumNous/new-api`](https://github.com/QuantumNous/new-api)** (AGPLv3), lui-même basé sur [One API](https://github.com/songquanpeng/one-api) (MIT). Ce fork :

- Suit en continu la branche `main` amont. Les modifications spécifiques au fork sont autonomes et listées ci-dessous.
- Est responsable de ses propres modifications et les signale conformément à la section 7(c) de l'AGPLv3.
- **Préserve la mention d'attribution requise :** `Frontend design and development by New API contributors.`
- **Préserve un lien visible vers le projet original :** <https://github.com/QuantumNous/new-api>

Voir [Licence](#-licence) et [`NOTICE`](./NOTICE) pour les conditions complètes.

---

<!-- FORK-DELTA: NextRouter changes vs upstream QuantumNous/new-api.
     Update after merging any fork-only branch.
     Completeness check: git log --oneline --no-merges upstream/main..HEAD
     Last verified: 2026-07-16 -->

## ✨ Les nouveautés de NextRouter

> La liste ci-dessous présente les principales différences avec l'amont, sans prétendre être exhaustive. Consultez les [GitHub Releases](https://github.com/WebAgentLoop/nextrouter/releases) pour les changements complets de chaque version publiée ; pour les fonctionnalités amont, consultez la documentation officielle.

### 🤖 Boucle d'agent côté navigateur

Un nouveau module de barre latérale **Agent** (`/agent`, à activer sous *Profile → Sidebar modules*) implémente une boucle de conversation d'agent complète qui s'exécute entièrement dans le navigateur.

- Réutilise le relais playground `/pg/chat/completions` avec le format OpenAI function-calling ; fournit un registre d'outils intégré et un outil **calculatrice** (évaluation sûre d'expressions).
- Analyse en flux les appels d'outils ; agrège chaque tour de l'assistant en une seule carte avec un panneau **Process** repliable.
- Actions sur les messages : copier / régénérer / éditer (avec ou sans renvoi) / supprimer.
- Historique multi-sessions persisté dans **IndexedDB** (jusqu'à 50 sessions), avec renommer / basculer / supprimer.
- Un plafond d'itérations empêche les boucles d'appels d'outils incontrôlées ; traduit dans 7 langues.

### ⚡ Améliorations des canaux et du Relay

- **Force Stream** (paramètre de canal) : pour les amonts qui ne prennent en charge *que* le streaming, lorsqu'un client envoie une requête non streamée, la passerelle met en mémoire tampon le flux SSE et renvoie une seule réponse JSON non streamée (logique de mise en tampon côté backend + tests unitaires).
- Les commutateurs **Force Format / Force Stream** sont désormais disponibles pour les canaux **Advanced Custom** (auparavant uniquement pour le canal OpenAI).
- `/pg/chat/completions` est désormais proposé comme option de chemin entrant pour Advanced Custom.

### 🧩 Gestion des modèles

- **Boîte de dialogue de gestion des vendeurs** : liste tous les vendeurs de modèles avec édition / suppression / ajout (auparavant uniquement la création), avec réessai en cas d'erreur.
- **Fusion du modèle d'endpoints** : l'enregistrement fusionne désormais au lieu de tout remplacer ; un JSON d'endpoints existant invalide déclenche un avertissement avant la fusion.

### 📊 Observabilité des performances

- **Taux de cache hit au niveau des tokens** : enregistre les tokens d'entrée mis en cache et le total des tokens d'entrée, calcule le taux de cache hit par modèle, groupe et période, puis affiche les performances actuelles et récentes du cache dans les badges et les détails de performance des modèles.

### 💰 Portefeuille et paiements

- Correction de l'affichage du montant du portefeuille pour le mode de devise personnalisée (CUSTOM) et le fournisseur de paiement Waffo Pancake.

### 📦 Versions et déploiement

- Le workflow Docker manuel construit et signe nativement les images amd64 / arm64, puis ne promeut `latest` qu'après la réussite du manifeste multi-architecture.
- Chaque version crée un tag d'image immuable `latest-YYYY.MM.DD.N` et une GitHub Release contenant les changements classés, le digest de l'image et la commande de retour arrière.

<!-- /FORK-DELTA -->

---

## 🚀 Démarrage rapide

### Avec Docker Compose (recommandé)

```bash
# Cloner le fork
git clone https://github.com/WebAgentLoop/nextrouter.git
cd nextrouter

# Éditer la configuration docker-compose.yml
nano docker-compose.yml

# Démarrer le service
docker-compose up -d
```

<details>
<summary><strong>Avec les commandes Docker</strong></summary>

```bash
# Récupérer la dernière image
docker pull webagentloop/nextrouter:latest

# Avec SQLite (par défaut)
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest

# Avec MySQL
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

> **💡 Astuce :** `-v ./data:/data` enregistre les données dans le dossier `data` du répertoire courant ; utilisez un chemin absolu comme `-v /votre/chemin/perso:/data` si vous préférez.

</details>

Après le déploiement, visitez `http://localhost:3000` pour commencer.

### Migration depuis new-api (amont)

Vous utilisez déjà `calciumion/new-api` ? Passer à NextRouter ne nécessite **aucune migration de données** — le seul changement est le nom de l'image :

| Élément                       | new-api (amont)                      | nextrouter (fork)                | Impact                         |
| ----------------------------- | ------------------------------------ | -------------------------------- | ------------------------------ |
| **Image Docker**              | `calciumion/new-api:latest`          | `webagentloop/nextrouter:latest` | ✅ Le *seul* changement         |
| **Volume de données**         | `./data:/data` (ou personnalisé)     | `./data:/data` (ou personnalisé) | ✅ Inchangé                     |
| **Fichier SQLite**            | `one-api.db`                         | `one-api.db`                     | ✅ Inchangé                     |
| **Port**                      | `3000`                               | `3000`                           | ✅ Inchangé                     |
| **Variables d'environnement** | `SQL_DSN`, `REDIS_CONN_STRING`, etc. | Mêmes variables                  | ✅ Inchangé                     |
| **Base de données distante**  | MySQL / PostgreSQL                   | MySQL / PostgreSQL               | ✅ Inchangé, données préservées |

```bash
# Arrêter l'ancien conteneur
docker stop new-api && docker rm new-api

# Démarrer avec les mêmes volumes et environnement
docker run --name nextrouter -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  webagentloop/nextrouter:latest
```

Pour Docker Compose, remplacez `image: calciumion/new-api` par `image: webagentloop/nextrouter:latest` et exécutez `docker compose up -d`. GORM applique automatiquement les modifications de schéma au premier démarrage — vos données SQLite, MySQL ou PostgreSQL sont préservées intactes.

---

## 📦 Images et déploiement

| Composant | Prérequis |
|------|------|
| **Image** | `webagentloop/nextrouter:latest` |
| **Base de données locale** | SQLite (Docker doit monter le répertoire `/data`) |
| **Base de données distante** | MySQL ≥ 5.7.8 ou PostgreSQL ≥ 9.6 |
| **Moteur de conteneurs** | Docker / Docker Compose |
| **Architecture** | 64 bits uniquement (amd64 / arm64) ; 32 bits non pris en charge |

> [!TIP]
> `latest` est un **tag de version roulant** qui ne change qu'après la réussite d'une publication multi-architecture déclenchée manuellement. Pour un déploiement reproductible et un retour arrière, épinglez un tag immuable tel que `webagentloop/nextrouter:latest-2026.07.16.1`.

> [!WARNING]
> Pour un déploiement multi-machines, vous **devez** définir `SESSION_SECRET` (sinon l'état de connexion est incohérent), et un Redis partagé **doit** définir `CRYPTO_SECRET` (sinon les données ne peuvent pas être déchiffrées).

📖 Pour toutes les variables d'environnement et méthodes de déploiement, consultez les guides amont [Variables d'environnement](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) et [Installation](https://docs.newapi.pro/en/docs/installation) — ils s'appliquent également à ce fork.

---

## 📚 Documentation

La documentation amont couvre l'ensemble des fonctionnalités, la référence API et la configuration, et s'applique à NextRouter :

| Catégorie | Lien |
|------|------|
| 🚀 Guide de déploiement | [Installation](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ Configuration | [Variables d'environnement](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 Documentation API | [Référence API](https://docs.newapi.pro/en/docs/api) |
| ❓ FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |

---

## 🔧 Maintenance : suivi de l'amont

NextRouter maintient une branche longue durée `nextrouter` qui fusionne en continu `upstream/main`. Les fonctionnalités spécifiques au fork sont développées sur des branches de fonctionnalité (par ex. `feat/frontend-agent-loop`) puis fusionnées dans `nextrouter`.

Lors de la fusion d'une branche spécifique au fork, la section [Les nouveautés](#-les-nouveautés-de-nextrouter) doit être mise à jour. Le delta exact est toujours dérivable via :

```bash
git log --oneline --no-merges upstream/main..HEAD
```

Voir `AGENTS.md` → *Fork Documentation Maintenance* pour la liste de vérification complète de mise à jour multilingue.

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Lors de l'ouverture d'une PR qui ajoute ou modifie une fonctionnalité spécifique au fork :

1. Mettez à jour le bloc `<!-- FORK-DELTA -->` dans **toutes** les langues du README (`README.md`, `README.zh_CN.md`, `README.zh_TW.md`, `README.fr.md`, `README.ja.md`) — même structure, seule la langue diffère.
2. Mettez à jour la date `Last verified` dans chaque bloc.
3. Conservez toutes les attributions new-api / QuantumNous, le lien amont et la mention Section 7 AGPLv3.

---

## 📜 Licence

Ce projet est sous licence [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Des termes additionnels s'appliquent au titre de la Section 7 de l'AGPLv3 (voir [`NOTICE`](./NOTICE)). Les versions modifiées **doivent préserver** la mention d'attribution `Frontend design and development by New API contributors.` dans les mentions légales appropriées et dans tout emplacement visible « à propos », légal, pied de page ou attribution présenté par l'interface utilisateur.

Les versions modifiées qui présentent une interface utilisateur doivent également préserver un lien visible vers le projet original : <https://github.com/QuantumNous/new-api>.

Il s'agit d'un projet open source basé sur [One API](https://github.com/songquanpeng/one-api) (licence MIT).

---

## 🙏 Remerciements

NextRouter s'appuie sur le travail des contributeurs de **[new-api](https://github.com/QuantumNous/new-api)** et de **[One API](https://github.com/songquanpeng/one-api)**. Merci à eux.

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=WebAgentLoop/nextrouter&type=Date)](https://star-history.com/#WebAgentLoop/nextrouter&Date)

</div>

---

<div align="center">

<sub>Construit sur [QuantumNous/new-api](https://github.com/QuantumNous/new-api) · Frontend design and development by New API contributors.</sub>

</div>
