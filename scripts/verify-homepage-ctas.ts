import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${desc}`);
  }
}

function runTests() {
  console.log('--- Homepage CTAs Visual Refinement Verification ---\n');

  const homeFile = path.resolve(process.cwd(), 'src/pages/Home.tsx');
  const content = fs.readFileSync(homeFile, 'utf-8');

  // Suite 1: Customize Your Realm Section
  console.log('[Suite 1] Customize Your Realm Section');
  {
    // Start Designing
    assert(content.includes('to="/customize"'), 'Customize Your Realm links to /customize');
    assert(content.includes('Start Designing'), 'Start Designing CTA text is preserved');
    assert(content.includes('bg-black text-white'), 'Start Designing retains bold black background');
    assert(content.includes('hover:bg-white hover:text-black'), 'Start Designing inverts to white on hover');

    // Visual Wall Grid matches Start Designing
    assert(content.includes('to="/poster-grid"'), 'Visual Wall Grid links to /poster-grid');
    assert(content.includes('Visual Wall Grid'), 'Visual Wall Grid CTA text is present');
    assert(content.includes('bg-black text-white font-display text-xl sm:text-2xl uppercase tracking-widest hover:bg-white hover:text-black'), 'Visual Wall Grid matches Start Designing in typography, colors, and hover');
    assert(content.includes('ArrowRight size={22}'), 'Visual Wall Grid includes ArrowRight icon');
    assert(content.includes('stroke-[2.5]'), 'Visual Wall Grid arrow icon has bold stroke for clear visibility');
    assert(content.includes('py-4.5 sm:py-5'), 'Visual Wall Grid shares matching height/padding with Start Designing');
  }

  // Suite 2: Main Hero Section
  console.log('\n[Suite 2] Main Hero Section CTAs');
  {
    // Button 1: Shop Posters
    assert(content.includes('to="/collections"'), 'Shop Posters links to /collections');
    assert(content.includes('Shop Posters'), 'Shop Posters text is present');
    assert(content.includes('bg-brand-red text-white'), 'Shop Posters is primary red button');

    // Button 2: Create Custom Poster
    assert(content.includes('Create Custom Poster'), 'Create Custom Poster text is present');
    assert(content.includes('border-2 sm:border-4 border-white'), 'Create Custom Poster has white border');

    // Compact Button-Style CTA: Build Your Poster Grid
    assert(content.includes('Looking to create a wall collection?'), 'Supporting text "Looking to create a wall collection?" is present');
    assert(content.includes('Build Your Poster Grid'), 'Build Your Poster Grid text CTA is present');
    assert(content.includes('to="/poster-grid"'), 'Build Your Poster Grid links to /poster-grid');
    assert(content.includes('bg-brand-red'), 'Build Your Poster Grid has solid brand-red background');
    assert(content.includes('text-white'), 'Build Your Poster Grid has white text and arrow');
    assert(content.includes('hover:bg-[#c92a37]'), 'Build Your Poster Grid has slightly darker red on hover');
    assert(content.includes('hover:-translate-y-0.5'), 'Build Your Poster Grid has subtle upward movement on hover');
    assert(content.includes('px-4 sm:px-5 py-2 sm:py-2.5'), 'Build Your Poster Grid has comfortable compact padding');
  }

  // Suite 3: Responsive Design & Hierarchy
  console.log('\n[Suite 3] Responsive Layout & Design Consistency');
  {
    assert(content.includes('flex flex-col sm:flex-row items-stretch sm:items-center'), 'Hero main buttons stack vertically on mobile and align side-by-side on desktop');
    assert(content.includes('w-full sm:w-auto'), 'Buttons expand to full width on mobile (w-full) and auto width on desktop (sm:w-auto)');
    assert(content.includes('whitespace-nowrap'), 'Buttons prevent awkward text wrapping');
    assert(content.includes('font-display'), 'Buttons use Posterealm condensed display font');
  }

  console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${failedTests} failures)`);
  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
