import "./style.css";
import { AshfallGame } from "./game.js";
import { account } from "./services/account.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="shell">
    <section id="landing" class="landing">
      <div class="brand">
        <div class="brand__rune">A</div>
        <div>
          <p class="eyebrow">A living dark-fantasy world</p>
          <h1>Ashfall <span>Online</span></h1>
        </div>
      </div>
      <div class="landing__content">
        <div class="pitch">
          <p class="kicker">THE EMBERS REMEMBER</p>
          <h2>Wejdź do świata,<br/>który nie czeka.</h2>
          <p>Eksploruj ruiny, rozwijaj profesję, zdobywaj ekwipunek i walcz u boku innych graczy — bez instalacji.</p>
          <div class="features">
            <span>✦ wspólny świat</span><span>✦ rozwój bez limitu</span><span>✦ zapis w chmurze</span>
          </div>
        </div>
        <form id="entry-form" class="entry-card">
          <div>
            <p class="eyebrow">CREATE YOUR LEGEND</p>
            <h3>Nowa postać</h3>
          </div>
          <label>Nazwa postaci
            <input id="character-name" maxlength="18" value="Wędrowiec" autocomplete="off" />
          </label>
          <fieldset>
            <legend>Profesja</legend>
            <div class="class-grid">
              <label class="class active"><input type="radio" name="vocation" value="warden" checked/><b>Warden</b><small>miecz i tarcza</small></label>
              <label class="class"><input type="radio" name="vocation" value="ranger"/><b>Ranger</b><small>łuk i pułapki</small></label>
              <label class="class"><input type="radio" name="vocation" value="arcanist"/><b>Arcanist</b><small>ogień i energia</small></label>
              <label class="class"><input type="radio" name="vocation" value="druid"/><b>Druid</b><small>natura i leczenie</small></label>
            </div>
          </fieldset>
          <button class="primary" type="submit"><span>Rozpocznij przygodę</span><b>→</b></button>
          <button class="ghost" id="login-button" type="button">Zaloguj / zarejestruj przez e-mail</button>
          <p id="connection-note" class="connection-note">Tryb gościa działa od razu. Konto Supabase jest opcjonalne.</p>
        </form>
      </div>
      <footer><span>ASHFALL ONLINE · ALPHA</span><span>WASD / STRZAŁKI · MYSZ · 1–4 · E</span></footer>
    </section>
    <section id="game-root" class="game-root hidden"></section>
  </main>
  <dialog id="auth-dialog">
    <form id="auth-form" method="dialog">
      <button class="dialog-close" value="cancel" aria-label="Zamknij">×</button>
      <p class="eyebrow">CLOUD SAVE</p>
      <h3>Konto gracza</h3>
      <p class="muted">Postać będzie dostępna na każdym urządzeniu.</p>
      <label>E-mail<input id="auth-email" type="email" required placeholder="gracz@example.com"/></label>
      <label>Hasło<input id="auth-password" type="password" minlength="6" required placeholder="minimum 6 znaków"/></label>
      <button class="primary" type="submit">Zaloguj się</button>
      <button id="signup-button" class="ghost" type="button">Utwórz konto</button>
      <p id="auth-message" class="connection-note"></p>
    </form>
  </dialog>
`;

const landing = document.querySelector("#landing");
const gameRoot = document.querySelector("#game-root");
const authDialog = document.querySelector("#auth-dialog");
const authMessage = document.querySelector("#auth-message");

document.querySelectorAll(".class").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".class").forEach((other) => other.classList.remove("active"));
    card.classList.add("active");
  });
});

document.querySelector("#login-button").addEventListener("click", () => authDialog.showModal());

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await account.signIn(
    document.querySelector("#auth-email").value,
    document.querySelector("#auth-password").value
  );
  authMessage.textContent = result.message;
  if (result.ok) setTimeout(() => authDialog.close(), 500);
});

document.querySelector("#signup-button").addEventListener("click", async () => {
  const result = await account.signUp(
    document.querySelector("#auth-email").value,
    document.querySelector("#auth-password").value
  );
  authMessage.textContent = result.message;
});

document.querySelector("#entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#character-name").value.trim() || "Wędrowiec";
  const vocation = new FormData(event.currentTarget).get("vocation");
  landing.classList.add("leaving");
  landing.classList.add("hidden");
  gameRoot.classList.remove("hidden");
  const game = new AshfallGame(gameRoot, { name, vocation, account });
  game.start();
});

account.session().then((user) => {
  if (user) document.querySelector("#login-button").textContent = `Połączono: ${user.email}`;
});
