import axios from 'axios';
import { DOMParser } from '@xmldom/xmldom';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';  
export class Currency {
  rates: Record<string, number> = {};
  seenRates: Record<string, number> = {};
  private fetchPromise: Promise<void> | null = null;
  private backupPath: string;
  private loaded = false;

  constructor() {
    // Resolve backup path to userData (writable app dir)
    this.backupPath = path.join(app.getPath('userData'), 'currency.json');
  }

  async init() {
    if (!this.loaded) {
      await this.loadBackup();
      this.loaded = true;
    }
    if (!this.fetchPromise) {
      this.fetchPromise = this.fetchLiveRates();
    }
    // Do not block app startup on ECB network; backup rates are enough for first paint.
    void this.fetchPromise;
  }

  private async loadBackup() {
    try {
      const data = await fs.readFile(this.backupPath, 'utf8');
      const ratesModule = JSON.parse(data);
      this.rates = ratesModule.rates || {};
      this.rates['EUR'] = 1;
      console.log('Backup loaded from userData.');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // NEW: Create if not exists
        this.rates = { EUR: 1 }; // Initial minimal rates
        await this.updateBackup();
        console.log('Backup JSON created in userData.');
      } else {
        console.error('Error loading backup JSON:', error);
        this.rates = { EUR: 1 }; // Fallback on other errors
      }
    }
  }

  private async fetchLiveRates() {
    try {
      const response = await axios.get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {
        timeout: 5000, // Prevent hangs
      });
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'application/xml');
      const cubes = doc.getElementsByTagName('Cube');
      const newRates: Record<string, number> = { EUR: 1 };

      for (let i = 0; i < cubes.length; i++) {
        const cube = cubes[i];
        if (cube.hasAttribute('currency') && cube.hasAttribute('rate')) {
          const currency = cube.getAttribute('currency')?.toUpperCase();
          const rateStr = cube.getAttribute('rate');
          const rate = parseFloat(rateStr || 'NaN');
          if (currency && !isNaN(rate)) {
            newRates[currency] = rate;
          }
        }
      }

      // Merge live over existing (backup)
      this.rates = { ...this.rates, ...newRates };
      console.log('Live ECB rates fetched:', Object.keys(this.rates));

      // Auto-update backup JSON on success
      await this.updateBackup();
    } catch (error) {
      console.error('Error fetching ECB rates:', error);
      // Stick with backup; no update
    }
  }

  private async updateBackup() {
    try {
      const jsonContent = JSON.stringify({ rates: this.rates }, null, 2);
      await fs.writeFile(this.backupPath, jsonContent, 'utf8');
      console.log('Backup JSON updated in userData.');
    } catch (error) {
      console.error('Error updating backup JSON:', error);
    }
  }

  async getRate(exchangeTo: string): Promise<number> {
    const upperTo = exchangeTo.toUpperCase();
    if (this.seenRates[upperTo] !== undefined) {
      return this.seenRates[upperTo];
    }

    await this.init(); // Ensure loaded/fetched (idempotent)

    let rate = this.rates[upperTo];
    if (typeof rate !== 'number' || isNaN(rate)) {
      console.warn(`Rate for ${upperTo} not found; falling back.`);
      rate = upperTo === 'EUR' ? 1 : this.rates['USD'] || 1; // Arbitrary fallback
    }

    this.seenRates[upperTo] = rate;
    return rate;
  }
}