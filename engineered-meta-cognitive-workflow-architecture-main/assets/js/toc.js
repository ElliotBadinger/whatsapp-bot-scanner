/**
 * Table of Contents (TOC) System
 * This file implements separate TOC generation for desktop and mobile views
 * to address issues with heading hierarchy and accordion functionality.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize both TOC systems
  initTOC();
});

/**
 * Main TOC initialization function
 * Detects viewport and initializes appropriate TOC
 */
function initTOC() {
  // Find the main content section
  const contentSection = document.querySelector('.content-column');
  const desktopTocContainer = document.getElementById('toc-list');
  const mobileTocContainer = document.getElementById('mobile-toc-list');

  if (!contentSection) return;

  // Find all headings in the content
  const headings = contentSection.querySelectorAll('h1, h2, h3');
  if (headings.length < 2) return; // Don't create TOC for just one heading

  // Process headings to ensure they have IDs
  processHeadings(headings);

  // Generate heading hierarchy data structure
  const tocData = generateTOCData(headings);

  // Create desktop TOC if container exists
  if (desktopTocContainer) {
    createDesktopTOC(desktopTocContainer, tocData);
  }

  // Create mobile TOC if container exists
  if (mobileTocContainer) {
    createMobileAccordionTOC(mobileTocContainer, tocData);
  }

  // Set up scroll tracking to highlight active sections
  setupScrollTracking(tocData);
}

/**
 * Process headings to ensure they all have IDs
 * @param {NodeList} headings - List of heading elements
 */
function processHeadings(headings) {
  headings.forEach(function(heading) {
    // Skip any "Contents" or "Table of Contents" heading
    if (heading.textContent.trim() === 'Contents' ||
        heading.textContent.trim() === 'Table of Contents') return;

    // Create ID from heading text if it doesn't have one
    if (!heading.id) {
      const id = heading.textContent.toLowerCase()
        .replace(/[^\w\s-]/g, '')   // Remove special chars
        .replace(/\s+/g, '-')       // Replace spaces with hyphens
        .replace(/-+/g, '-');       // Replace multiple hyphens with single
      heading.id = id;
    }
  });
}

/**
 * Generate hierarchical TOC data structure
 * @param {NodeList} headings - List of heading elements
 * @returns {Array} Hierarchical TOC data structure
 */
function generateTOCData(headings) {
  let tocData = [];
  let currentH1Section = null;

  headings.forEach(function(heading) {
    // Skip any "Contents" or "Table of Contents" heading
    if (heading.textContent.trim() === 'Contents' ||
        heading.textContent.trim() === 'Table of Contents') return;

    const headingType = heading.tagName.toLowerCase();

    if (headingType === 'h1') {
      // Create a new h1 section
      currentH1Section = {
        title: heading.textContent,
        id: heading.id,
        element: heading,
        subheadings: []
      };
      tocData.push(currentH1Section);
    } else if (headingType === 'h2' && currentH1Section) {
      // Add h2 as a subheading to the current h1 section
      currentH1Section.subheadings.push({
        title: heading.textContent,
        id: heading.id,
        element: heading
      });
    }
    // We're ignoring h3 for now to keep the TOC cleaner
  });

  return tocData;
}

/**
 * Create desktop TOC with hierarchical structure
 * @param {HTMLElement} container - Desktop TOC container element
 * @param {Array} tocData - Hierarchical TOC data
 */
function createDesktopTOC(container, tocData) {
  // Clear container
  container.innerHTML = '';

  // Create TOC list
  const tocList = document.createElement('ul');
  tocList.className = 'toc-list';

  // Create entries for each section
  tocData.forEach(function(section) {
    // Create main section list item
    const sectionItem = document.createElement('li');
    sectionItem.className = 'toc-item toc-h1';

    // Create link for main section
    const sectionLink = document.createElement('a');
    sectionLink.href = '#' + section.id;
    sectionLink.textContent = section.title;
    sectionLink.className = 'toc-link';
    sectionLink.setAttribute('data-id', section.id);

    sectionItem.appendChild(sectionLink);

    // Create sublist for subsections if any exist
    if (section.subheadings && section.subheadings.length > 0) {
      const subList = document.createElement('ul');
      subList.className = 'toc-sublist';

      // Create entries for each subsection
      section.subheadings.forEach(function(subsection) {
        const subItem = document.createElement('li');
        subItem.className = 'toc-item toc-h2';

        const subLink = document.createElement('a');
        subLink.href = '#' + subsection.id;
        subLink.textContent = subsection.title;
        subLink.className = 'toc-link';
        subLink.setAttribute('data-id', subsection.id);

        subItem.appendChild(subLink);
        subList.appendChild(subItem);
      });

      sectionItem.appendChild(subList);
    }

    tocList.appendChild(sectionItem);
  });

  container.appendChild(tocList);

  // Set up click handlers for smooth scrolling
  setupSmoothScrolling(container);
}

/**
 * Create mobile accordion TOC
 * @param {HTMLElement} container - Mobile TOC container element
 * @param {Array} tocData - Hierarchical TOC data
 */
function createMobileAccordionTOC(container, tocData) {
  // Clear container
  container.innerHTML = '';

  // Create accordion container
  const accordion = document.createElement('aside');
  accordion.className = 'p-accordion mobile-accordion';

  const accordionList = document.createElement('ul');
  accordionList.className = 'p-accordion__list';

  accordion.appendChild(accordionList);

  // Create accordion items for each section
  tocData.forEach(function(section, index) {
    const accordionId = 'accordion-section-' + index;

    // Create accordion group
    const accordionGroup = document.createElement('li');
    accordionGroup.className = 'p-accordion__group';

    // Create heading and button
    const accordionHeading = document.createElement('h3');
    accordionHeading.className = 'p-accordion__heading';

    const accordionTab = document.createElement('button');
    accordionTab.className = 'p-accordion__tab';
    accordionTab.type = 'button';
    accordionTab.id = accordionId;
    accordionTab.setAttribute('aria-controls', accordionId + '-panel');
    // Only first panel is open by default
    const isExpanded = index === 0;
    accordionTab.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    accordionTab.setAttribute('data-state', isExpanded ? 'open' : 'closed');
    accordionTab.textContent = section.title;

    accordionHeading.appendChild(accordionTab);
    accordionGroup.appendChild(accordionHeading);

    // Create panel
    const accordionPanel = document.createElement('section');
    accordionPanel.className = 'p-accordion__panel';
    accordionPanel.id = accordionId + '-panel';
    accordionPanel.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
    accordionPanel.setAttribute('aria-labelledby', accordionId);

    // Add links to the panel
    if (section.subheadings.length > 0) {
      const subList = document.createElement('ul');
      subList.className = 'toc-subheadings';

      // Add a link to the main section as first item
      const mainItem = document.createElement('li');
      const mainLink = document.createElement('a');
      mainLink.href = '#' + section.id;
      mainLink.textContent = "Section overview";
      mainLink.className = 'toc-overview-link';
      mainItem.appendChild(mainLink);
      subList.appendChild(mainItem);

      // Add links to subheadings
      section.subheadings.forEach(function(subheading) {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#' + subheading.id;
        link.textContent = subheading.title;
        listItem.appendChild(link);
        subList.appendChild(listItem);
      });

      accordionPanel.appendChild(subList);
    } else {
      // If no subheadings, add a direct link to the heading
      const link = document.createElement('a');
      link.href = '#' + section.id;
      link.textContent = "Go to section";
      accordionPanel.appendChild(link);
    }

    accordionGroup.appendChild(accordionPanel);
    accordionList.appendChild(accordionGroup);
  });

  // Add the accordion to the container
  container.appendChild(accordion);

  // Setup accordion toggle functionality
  setupAccordionToggle(accordion);
}

/**
 * Set up accordion toggle functionality
 * @param {HTMLElement} accordion - The accordion container element
 */
function setupAccordionToggle(accordion) {
  // Add click event listener to the accordion container
  accordion.addEventListener('click', function(event) {
    // Find the clicked accordion tab button
    let target = event.target;
    if (target.closest) {
      target = target.closest('.p-accordion__tab');
    }

    if (target) {
      // Get current state
      const isExpanded = target.getAttribute('aria-expanded') === 'true';
      const panel = document.getElementById(target.getAttribute('aria-controls'));

      // Toggle clicked panel state
      target.setAttribute('aria-expanded', !isExpanded);
      target.setAttribute('data-state', isExpanded ? 'closed' : 'open');

      if (panel) {
        panel.setAttribute('aria-hidden', isExpanded);
      }

      // Optional: Close other panels (for accordion behavior)
      const allTabs = accordion.querySelectorAll('.p-accordion__tab');
      allTabs.forEach(function(tab) {
        if (tab !== target) {
          const otherPanel = document.getElementById(tab.getAttribute('aria-controls'));
          tab.setAttribute('aria-expanded', 'false');
          tab.setAttribute('data-state', 'closed');
          if (otherPanel) {
            otherPanel.setAttribute('aria-hidden', 'true');
          }
        }
      });
    }
  });
}

/**
 * Set up smooth scrolling for TOC links
 * @param {HTMLElement} container - TOC container element
 */
function setupSmoothScrolling(container) {
  container.addEventListener('click', function(event) {
    // Check if clicked element is a link
    if (event.target.tagName.toLowerCase() === 'a') {
      event.preventDefault();

      // Get the target element from the href
      const targetId = event.target.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        // Smooth scroll to the target
        window.scrollTo({
          top: targetElement.offsetTop - 20, // Offset for better visibility
          behavior: 'smooth'
        });

        // Update URL hash without scrolling
        history.pushState(null, null, '#' + targetId);
      }
    }
  });
}

/**
 * Set up scroll tracking to highlight active sections
 * @param {Array} tocData - Hierarchical TOC data
 */
function setupScrollTracking(tocData) {
  // Throttle function to improve scroll performance
  function throttle(func, delay) {
    let lastCall = 0;
    return function() {
      const now = new Date().getTime();
      if (now - lastCall < delay) {
        return;
      }
      lastCall = now;
      func.apply(this, arguments);
    };
  }

  // Function to update active TOC items
  function updateActiveTOCItems() {
    // Get all headings with IDs
    const headingElements = [];
    tocData.forEach(function(section) {
      headingElements.push(section.element);
      section.subheadings.forEach(function(subsection) {
        headingElements.push(subsection.element);
      });
    });

    // Find which heading is currently at the top of the viewport
    let activeId = '';
    for (let i = 0; i < headingElements.length; i++) {
      const heading = headingElements[i];
      const rect = heading.getBoundingClientRect();

      // If the heading is in the viewport or just above it
      if (rect.top <= 100) {
        activeId = heading.id;
      } else {
        // Once we find a heading below the viewport, we can stop
        break;
      }
    }

    // Update active state for desktop TOC
    if (activeId) {
      const desktopLinks = document.querySelectorAll('#toc-list .toc-link');
      desktopLinks.forEach(function(link) {
        // Remove active class from all links
        link.classList.remove('active');

        // Add active class to the link that matches the active heading
        if (link.getAttribute('data-id') === activeId) {
          link.classList.add('active');

          // If it's a subheading, also highlight its parent
          const parentListItem = link.closest('li.toc-h2');
          if (parentListItem) {
            const parentList = parentListItem.closest('ul.toc-sublist');
            if (parentList) {
              const parentLink = parentList.previousElementSibling;
              if (parentLink && parentLink.classList.contains('toc-link')) {
                parentLink.classList.add('parent-active');
              }
            }
          }
        }
      });

      // Update active state for mobile TOC
      const mobileLinks = document.querySelectorAll('.mobile-accordion a');
      mobileLinks.forEach(function(link) {
        // Remove active class from all links
        link.classList.remove('active');

        // Add active class to the link that matches the active heading
        if (link.getAttribute('href') === '#' + activeId) {
          link.classList.add('active');

          // Expand the accordion panel if it's collapsed
          const panel = link.closest('.p-accordion__panel');
          if (panel) {
            const accordionId = panel.getAttribute('aria-labelledby');
            if (accordionId) {
              const accordionTab = document.getElementById(accordionId);
              if (accordionTab && accordionTab.getAttribute('aria-expanded') === 'false') {
                // Trigger a click to expand the accordion
                accordionTab.click();
              }
            }
          }
        }
      });
    }
  }

  // Add throttled scroll event listener
  window.addEventListener('scroll', throttle(updateActiveTOCItems, 100));

  // Initialize active items on page load
  updateActiveTOCItems();
}
