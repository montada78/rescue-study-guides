// =============================================
// RESCUE STUDY GUIDES - Main JavaScript
// =============================================

// Toast Notification System
const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'success', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const colors = { success: 'border-green-500', error: 'border-red-500', info: 'border-blue-500', warning: 'border-yellow-500' };

    const toast = document.createElement('div');
    toast.className = `toast ${colors[type] || colors.success}`;
    toast.innerHTML = `
      <span class="text-xl">${icons[type] || icons.success}</span>
      <p class="text-sm font-medium text-gray-800 flex-1">${message}</p>
      <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600 ml-2">✕</button>
    `;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

// Cart Functions
const Cart = {
  async addItem(productId, btn) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner inline-block mr-2"></span>Adding...';
    }

    try {
      const res = await fetch(`/cart/add/${productId}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        Toast.show(data.message || 'Added to cart! 🛒', 'success');
        
        if (data.free && data.redirect) {
          setTimeout(() => window.location.href = data.redirect, 1500);
          return;
        }

        // Update cart count badge
        if (data.cartCount !== undefined) {
          const badge = document.querySelector('.cart-badge');
          if (badge) {
            badge.textContent = data.cartCount;
            badge.classList.remove('hidden');
          }
        }

        if (btn) {
          btn.innerHTML = '<i class="fas fa-check mr-2"></i>Added!';
          btn.classList.remove('bg-rescue-red');
          btn.classList.add('bg-green-600');
        }
      } else {
        Toast.show(data.message || 'Failed to add to cart', 'error');
        if (data.owned) {
          Toast.show('You already own this guide! Check your downloads.', 'info');
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i>Add to Cart';
        }
      }
    } catch (err) {
      Toast.show('Network error. Please try again.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i>Add to Cart';
      }
    }
  },

  async removeItem(productId) {
    try {
      const res = await fetch(`/cart/remove/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) location.reload();
    } catch (err) {
      Toast.show('Error removing item', 'error');
    }
  }
};

// Wishlist Functions
const Wishlist = {
  async toggle(productId, btn) {
    try {
      const res = await fetch(`/cart/wishlist/${productId}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        Toast.show(data.message, 'success');
        if (btn) {
          const icon = btn.querySelector('i');
          if (data.wishlisted) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            btn.classList.add('text-rescue-red');
          } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            btn.classList.remove('text-rescue-red');
          }
        }
      }
    } catch (err) {
      Toast.show('Error updating wishlist', 'error');
    }
  }
};

// Smooth scroll to section
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Format price
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

// Copy promo code
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    Toast.show(`Code "${code}" copied to clipboard! 🎉`, 'success');
  });
}

// Search suggestions
const searchInput = document.querySelector('input[name="search"]');
if (searchInput) {
  const suggestions = ['IGCSE Maths', 'AP Chemistry', 'Biology', 'Physics', 'SABIS Grade 10', 'English Language'];
  let suggestionIndex = 0;
  
  setInterval(() => {
    if (document.activeElement !== searchInput) {
      searchInput.placeholder = `Search for "${suggestions[suggestionIndex]}"...`;
      suggestionIndex = (suggestionIndex + 1) % suggestions.length;
    }
  }, 2500);
}

// Lazy loading for images
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
}

// Counter animation for stats
function animateCounter(el, target, duration = 2000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;

  const update = () => {
    current = Math.min(current + increment, target);
    el.textContent = Math.round(current).toLocaleString();
    if (current < target) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// Animate stats when visible
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      if (target) animateCounter(el, target);
      statsObserver.unobserve(el);
    }
  });
});

document.querySelectorAll('[data-count]').forEach(el => statsObserver.observe(el));

// Product image fallback
document.querySelectorAll('img.product-img').forEach(img => {
  img.onerror = () => {
    img.src = generateProductPlaceholder(img.dataset.subject || 'Study');
  };
});

function generateProductPlaceholder(subject) {
  const colors = {
    'Mathematics': '#E63946',
    'Biology': '#2A9D8F',
    'Chemistry': '#E76F51',
    'Physics': '#457B9D',
    'English': '#6D4C7D',
    'History': '#C77D52',
    default: '#E63946'
  };
  const color = colors[subject] || colors.default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <rect width="400" height="300" fill="${color}" rx="12"/>
    <text x="200" y="140" text-anchor="middle" fill="white" font-size="48">📚</text>
    <text x="200" y="190" text-anchor="middle" fill="white" font-size="18" font-family="Poppins,sans-serif">${subject}</text>
    <text x="200" y="218" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="13">Rescue Study Guide</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  
  // Add to cart buttons
  document.querySelectorAll('[data-add-cart]').forEach(btn => {
    btn.addEventListener('click', () => Cart.addItem(btn.dataset.addCart, btn));
  });

  // Wishlist buttons
  document.querySelectorAll('[data-wishlist]').forEach(btn => {
    btn.addEventListener('click', () => Wishlist.toggle(btn.dataset.wishlist, btn));
  });

  // Remove from cart
  document.querySelectorAll('[data-remove-cart]').forEach(btn => {
    btn.addEventListener('click', () => Cart.removeItem(btn.dataset.removeCart));
  });
});
