import { useEffect, useMemo, useRef, useState } from 'react';

export function CategoryMenu({ categories, activeCategory, onSelectCategory }) {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isBebidasExpanded, setIsBebidasExpanded] = useState(false);
  const categoryMenuRef = useRef(null);

  useEffect(() => {
    function handleWindowClick(event) {
      if (!categoryMenuRef.current || categoryMenuRef.current.contains(event.target)) {
        return;
      }
      setIsCategoryMenuOpen(false);
      setIsBebidasExpanded(false);
    }

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const bebidasSubcategories = useMemo(
    () => categories.filter((category) => {
      const normalized = String(category || '').trim().toLowerCase();
      return normalized === 'bebidas_con_alcohol'
        || normalized === 'bebidas_sin_alcohol'
        || normalized.startsWith('bebidas - ');
    }),
    [categories]
  );

  const primaryCategories = useMemo(
    () => categories.filter((category) => !bebidasSubcategories.includes(category)),
    [bebidasSubcategories, categories]
  );

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === 'all') {
      return 'Todas';
    }
    if (activeCategory === '__other__') {
      return 'Otros';
    }
    return activeCategory || 'Categoria';
  }, [activeCategory]);

  function toCategoryLabel(category) {
    if (category === 'all') {
      return 'Todas';
    }
    if (category === '__other__') {
      return 'Otros';
    }
    return category;
  }

  return (
    <section className="store-categories">
      <label className="store-category-select">
        Categoria
      </label>
      <div className="store-category-menu" ref={categoryMenuRef}>
        <button
          type="button"
          className="store-category-trigger"
          onClick={() => setIsCategoryMenuOpen((current) => !current)}
          aria-expanded={isCategoryMenuOpen}
        >
          <span>{toCategoryLabel(activeCategoryLabel)}</span>
          <span className={`store-category-arrow ${isCategoryMenuOpen ? 'open' : ''}`}>▾</span>
        </button>

        {isCategoryMenuOpen ? (
          <div className="store-category-panel">
            {primaryCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={`store-category-option ${activeCategory === category ? 'active' : ''}`}
                onClick={() => {
                  onSelectCategory(category);
                  setIsCategoryMenuOpen(false);
                  setIsBebidasExpanded(false);
                }}
              >
                {toCategoryLabel(category)}
              </button>
            ))}

            {bebidasSubcategories.length > 0 ? (
              <div className="store-category-group">
                <button
                  type="button"
                  className={`store-category-option store-category-option--group ${isBebidasExpanded ? 'expanded' : ''}`}
                  onClick={() => setIsBebidasExpanded((current) => !current)}
                >
                  <span>Bebidas</span>
                  <span className={`store-category-arrow ${isBebidasExpanded ? 'open' : ''}`}>▸</span>
                </button>

                {isBebidasExpanded ? (
                  <div className="store-category-subgroup">
                    {bebidasSubcategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`store-category-option store-category-option--sub ${activeCategory === category ? 'active' : ''}`}
                        onClick={() => {
                          onSelectCategory(category);
                          setIsCategoryMenuOpen(false);
                          setIsBebidasExpanded(false);
                        }}
                      >
                        {toCategoryLabel(category)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
