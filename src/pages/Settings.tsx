function Settings() {
  return (
    <main className="neo-container">
      <h2>Settings</h2>
      <div className="neo-card">
        <div className="form-row">
          <label>Density</label>
          <select defaultValue="cozy">
            <option value="compact">Compact</option>
            <option value="cozy">Cozy</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </div>
        <div className="form-row">
          <label>Keymap</label>
          <select defaultValue="default">
            <option value="default">Default</option>
            <option value="vim">Vim</option>
            <option value="emacs">Emacs</option>
          </select>
        </div>
      </div>
    </main>
  )
}

export default Settings 