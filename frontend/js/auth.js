const ViewAuth = (() => {
  function shellOn() {
    document.getElementById("auth-shell").classList.remove("hidden");
    document.getElementById("app-shell").classList.add("hidden");
  }

  function renderLogin() {
    shellOn();
    const root = document.getElementById("auth-shell");
    root.innerHTML = `
      <div class="auth-card">
        <div class="auth-card__brand">
          <span class="auth-card__mark">📅</span>
          <h1>Calendário de Tarefas</h1>
          <p>Organize seu tempo com clareza. Entre para continuar.</p>
        </div>
        <form id="login-form" class="auth-form">
          <label>Usuário ou e-mail
            <input type="text" name="identifier" required autocomplete="username" />
          </label>
          <label>Senha
            <input type="password" name="password" required autocomplete="current-password" />
          </label>
          <p class="auth-form__error" id="login-error"></p>
          <button type="submit" class="btn btn--primary btn--block">Entrar</button>
        </form>
        <p class="auth-card__switch">
          Ainda não tem conta? <a href="#/register">Cadastre-se</a>
        </p>
      </div>
    `;

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const errorEl = document.getElementById("login-error");
      errorEl.textContent = "";
      try {
        const payload = {
          username: form.get("identifier"),
          email: form.get("identifier"),
          password: form.get("password"),
        };
        const data = await API.login(payload);
        API.setToken(data.token);
        API.setUser(data.user);
        toast(`Bem-vindo(a), ${data.user.username}!`, "success");
        refreshUserChrome();
        window.location.hash = "#/calendar";
        router();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function renderRegister() {
    shellOn();
    const root = document.getElementById("auth-shell");
    root.innerHTML = `
      <div class="auth-card">
        <div class="auth-card__brand">
          <span class="auth-card__mark">📅</span>
          <h1>Criar conta</h1>
          <p>Leva menos de um minuto.</p>
        </div>
        <form id="register-form" class="auth-form">
          <label>Nome de usuário
            <input type="text" name="username" required minlength="3" autocomplete="username" />
          </label>
          <label>E-mail
            <input type="email" name="email" required autocomplete="email" />
          </label>
          <label>Senha
            <input type="password" name="password" required minlength="6" autocomplete="new-password" />
          </label>
          <p class="auth-form__error" id="register-error"></p>
          <button type="submit" class="btn btn--primary btn--block">Criar conta</button>
        </form>
        <p class="auth-card__switch">
          Já tem conta? <a href="#/login">Entrar</a>
        </p>
      </div>
    `;

    document.getElementById("register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const errorEl = document.getElementById("register-error");
      errorEl.textContent = "";
      try {
        const payload = {
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        };
        const data = await API.register(payload);
        API.setToken(data.token);
        API.setUser(data.user);
        toast(`Conta criada! Bem-vindo(a), ${data.user.username}.`, "success");
        refreshUserChrome();
        window.location.hash = "#/calendar";
        router();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  return { renderLogin, renderRegister };
})();