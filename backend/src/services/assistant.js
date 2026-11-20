export function parseBudget(question) {
  const normalized = question.replaceAll(',', '');

  const match = normalized.match(
    /(?:₱|php\s*)?(\d{2,6})(?:\.\d{1,2})?/i
  );

  return match ? Number(match[1]) : null;
}

const ignoredWords = new Set([
  'which',
  'what',
  'where',
  'show',
  'find',
  'give',
  'have',
  'does',
  'with',
  'that',
  'this',
  'below',
  'under',
  'above',
  'over',
  'less',
  'than',
  'more',
  'product',
  'products',
  'please',
  'recommend',
  'looking',
  'available',
  'stock',
  'price',
  'cost',
  'cheap',
  'budget',
  'peso',
  'pesos',
  'php',
  'the',
  'for',
  'and',
  'are',
  'can',
  'you'
]);

function getSearchTerms(question) {
  return question
    .toLowerCase()
    .replace(/\bonline\s+class(?:es)?\b/g, 'webcam headset')
    .replace(/(?:₱|php\s*)?\d[\d,]*(?:\.\d+)?/gi, ' ')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .filter((term) => !ignoredWords.has(term))
    .map((term) => term.endsWith('s') ? term.slice(0, -1) : term);
}

export function rankProducts(products, question) {
  const terms = getSearchTerms(question);
  const budget = parseBudget(question);

  return products
    .filter((product) => {
      const price = Number(product.price);

      return (
        product.active !== false &&
        product.stock > 0 &&
        (budget === null || price <= budget)
      );
    })
    .map((product) => {
      const text = [
        product.name,
        product.category,
        product.description
      ].join(' ').toLowerCase();

      const score = terms.reduce((total, term) => {
        return total + (text.includes(term) ? 1 : 0);
      }, 0);

      return {
        ...product,
        score
      };
    })
    .filter((product) => {

      if (terms.length > 0) {
        return product.score > 0;
      }


      return true;
    })
    .sort((a, b) => {
      return (
        b.score - a.score ||
        Number(a.price) - Number(b.price)
      );
    });
}

export function buildAssistantResponse(products, question) {
  const ranked = rankProducts(products, question).slice(0, 3);

  if (ranked.length === 0) {
    return {
      answer:
        'I could not find an in-stock product matching that request.',
      recommendedProducts: [],
      sources: []
    };
  }

  const names = ranked
    .map((product) => product.name)
    .join(', ');

  return {
    answer:
      `Based on the current ShopSmart catalog, consider: ${names}. ` +
      'These recommendations are based on available product information.',

    recommendedProducts: ranked.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      category: product.category,
      stock: product.stock
    })),

    sources: ranked.map((product) => ({
      type: 'product',
      id: product.id,
      name: product.name
    }))
  };
}
