import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get('countryCode');
  if (!countryCode) {
    return NextResponse.json({ error: 'Missing countryCode' }, { status: 400 });
  }

  try {
    // Resolve the Wikidata QID dynamically from the ISO alpha-2 country code (P297)
    const isoCode = countryCode.toUpperCase();
    const countryLookupSparql = `
      SELECT ?country WHERE {
        ?country wdt:P297 "${isoCode}" .
      }
      LIMIT 1
    `;
    const countryLookupUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(countryLookupSparql)}`;
    const countryRes = await fetch(countryLookupUrl, {
      headers: { 'User-Agent': 'hospital-finder/1.0 (+https://github.com/)' },
    });
    if (!countryRes.ok) {
      const text = await countryRes.text();
      console.error('Wikidata country lookup error:', countryRes.status, text);
      return NextResponse.json({ error: 'Wikidata country lookup error', status: countryRes.status, text }, { status: 500 });
    }
    const countryData = await countryRes.json();
    const countryUri: string | undefined = countryData?.results?.bindings?.[0]?.country?.value;
    if (!countryUri) {
      return NextResponse.json({ error: `Could not resolve country from ISO code: ${isoCode}` }, { status: 400 });
    }
    const countryQid = countryUri.split('/').pop();
    const sparql = `
      SELECT ?city ?cityLabel (MAX(?population) AS ?maxPopulation) WHERE {
        ?city wdt:P31/wdt:P279* wd:Q515;  # instance of city
              wdt:P17 wd:${countryQid};   # in country
              wdt:P1082 ?population.      # has population
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      GROUP BY ?city ?cityLabel
      ORDER BY DESC(?maxPopulation)
      LIMIT 50
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const wdRes = await fetch(url, {
      headers: { 'User-Agent': 'hospital-finder/1.0 (+https://github.com/)' },
    });
    if (!wdRes.ok) {
      const text = await wdRes.text();
      console.error('Wikidata error:', wdRes.status, text);
      return NextResponse.json({ error: 'Wikidata error', status: wdRes.status, text }, { status: 500 });
    }
    const wdData = await wdRes.json();
    type WikidataBinding = { cityLabel?: { value?: string } };
    const cityNames: string[] = (wdData.results.bindings || [])
      .map((b: WikidataBinding) => (b.cityLabel && b.cityLabel.value ? String(b.cityLabel.value).trim() : ''))
      .filter((n: string) => n.length > 0);
    const uniqueCityNames = Array.from(new Set(cityNames)).slice(0, 20);
    return NextResponse.json({
      cities: uniqueCityNames,
    });
  } catch (err) {
    console.error('Failed to fetch cities from Wikidata:', err);
    return NextResponse.json({ error: 'Failed to fetch cities from Wikidata', details: String(err) }, { status: 500 });
  }
}
