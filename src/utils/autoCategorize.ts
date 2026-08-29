export interface CategorizationRule {
  id: string;
  keyword: string;
  category_name: string;
  category_id?: string;
  type: 'EXPENSE' | 'INCOME';
}

export const DEFAULT_NATURAL_RULES: CategorizationRule[] = [
  // Food & Dining
  { id: 'r-1', keyword: 'swiggy', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-2', keyword: 'zomato', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-3', keyword: 'restaurant', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-4', keyword: 'biryani', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-5', keyword: 'hotel', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-6', keyword: 'tea', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-7', keyword: 'coffee', category_name: 'Food & Dining', type: 'EXPENSE' },
  { id: 'r-8', keyword: 'cafe', category_name: 'Food & Dining', type: 'EXPENSE' },
  
  // Grocery
  { id: 'r-9', keyword: 'dmart', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-10', keyword: 'blinkit', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-11', keyword: 'zepto', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-12', keyword: 'bigbasket', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-13', keyword: 'supermarket', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-14', keyword: 'milk', category_name: 'Grocery', type: 'EXPENSE' },
  { id: 'r-15', keyword: 'vegetable', category_name: 'Grocery', type: 'EXPENSE' },

  // Transport & Fuel
  { id: 'r-16', keyword: 'petrol', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-17', keyword: 'diesel', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-18', keyword: 'hpcl', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-19', keyword: 'iocl', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-20', keyword: 'bpcl', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-21', keyword: 'uber', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-22', keyword: 'ola', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-23', keyword: 'rapido', category_name: 'Transport & Fuel', type: 'EXPENSE' },
  { id: 'r-24', keyword: 'auto', category_name: 'Transport & Fuel', type: 'EXPENSE' },

  // Utilities & Bills
  { id: 'r-25', keyword: 'electricity', category_name: 'Utilities & Bills', type: 'EXPENSE' },
  { id: 'r-26', keyword: 'broadband', category_name: 'Utilities & Bills', type: 'EXPENSE' },
  { id: 'r-27', keyword: 'airtel', category_name: 'Utilities & Bills', type: 'EXPENSE' },
  { id: 'r-28', keyword: 'jio', category_name: 'Utilities & Bills', type: 'EXPENSE' },
  { id: 'r-29', keyword: 'water bill', category_name: 'Utilities & Bills', type: 'EXPENSE' },
  { id: 'r-30', keyword: 'recharge', category_name: 'Utilities & Bills', type: 'EXPENSE' },

  // Income Rules
  { id: 'r-31', keyword: 'salary', category_name: 'Salary', type: 'INCOME' },
  { id: 'r-32', keyword: 'freelance', category_name: 'Freelance', type: 'INCOME' },
  { id: 'r-33', keyword: 'dividend', category_name: 'Investment Returns', type: 'INCOME' },
  { id: 'r-34', keyword: 'interest', category_name: 'Investment Returns', type: 'INCOME' },
  { id: 'r-35', keyword: 'refund', category_name: 'Refund', type: 'INCOME' },
  { id: 'r-36', keyword: 'client payment', category_name: 'Business', type: 'INCOME' },
];

/**
 * Evaluates normal wording description against rules to return matching category
 */
export function autoSuggestCategory(
  description: string,
  categories: any[],
  customRules: CategorizationRule[] = []
): any | null {
  if (!description || !description.trim()) return null;

  const descLower = description.toLowerCase().trim();
  const allRules = [...customRules, ...DEFAULT_NATURAL_RULES];

  // Find first matching rule
  const matchedRule = allRules.find((rule) => descLower.includes(rule.keyword.toLowerCase()));
  if (!matchedRule) return null;

  // Find target category object in categories array
  const targetCategory = categories.find(
    (c) => c.name.toLowerCase() === matchedRule.category_name.toLowerCase()
  );

  return targetCategory || null;
}
