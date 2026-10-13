// Fresh profiles first show Pepper's welcome offer. Layout and gameplay fixtures
// take the ordinary "No, thanks" path before interacting with the world HUD.
export async function dismissWelcome(page) {
  const decline = page.locator('[data-action="welcome-pass"]');
  if (await decline.isVisible()) {
    await decline.click();
    await page.waitForSelector('#dialog-layer', { state: 'hidden' });
  }
}

// The online edition now opens on account entry. HUD fixtures explicitly select
// the existing local adventure before exercising controls.
export async function chooseOffline(page) {
  await page.waitForFunction(() => !!document.querySelector('.auth-solo') || (!!document.querySelector('#title-screen') && !document.querySelector('#title-screen').inert && !document.querySelector('#title-screen').classList.contains('account-entry')), null, { timeout: 60000 });
  const offline=page.locator('.auth-solo');if(await offline.isVisible())await offline.click();
}
