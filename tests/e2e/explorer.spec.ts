import {test,expect} from '@playwright/test';
test('public explorer discovers real scenes and exports measured evidence',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Every place. A changing story.'})).toBeVisible();
 await page.getByLabel('Search a place or ask a question').fill('18.5204,73.8567');
 await page.getByRole('button',{name:'Find location',exact:true}).click();
 await page.getByRole('button',{name:'18.5204,73.8567',exact:true}).click();
 await page.getByRole('button',{name:'Find observations',exact:true}).click();
 await expect(page.getByRole('heading',{name:/\d+ observations\./})).toBeVisible({timeout:40000});
 await page.getByRole('button',{name:/03 Jan 2025.*MGRS-43QCA/}).click();
 await page.getByRole('button',{name:/13 Jan 2025.*MGRS-43QCA/}).click();
 await page.getByRole('button',{name:'Compare & measure'}).click();
 await expect(page.getByRole('heading',{name:'Change, with context.'})).toBeVisible({timeout:150000});
 await expect(page.getByText('NDVI decrease',{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Evidence report · JSON'}).click();
 expect((await download).suggestedFilename()).toBe('terraseek-evidence.json');
});
test('2D map and methodology remain accessible without account',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'2D map',exact:true}).click();
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await page.getByRole('button',{name:'Evidence and limitations',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Evidence before conclusions.');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
