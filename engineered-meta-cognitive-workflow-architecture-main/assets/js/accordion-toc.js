document.addEventListener('DOMContentLoaded', function() {
  // Find the main content section
  const contentSection = document.querySelector('.content-column');
  const tocContainer = document.getElementById('toc-list');

  if (!contentSection || !tocContainer) return;

  // Find all h1, h2, h3 headings
  const headings = contentSection.querySelectorAll('h1, h2, h3');
  if (headings.length < 2) return; // Don't create TOC for just a few headings

  // Create accordion container
  const accordion = document.createElement('aside');
  accordion.className = 'p-accordion';

  const accordionList = document.createElement('ul');
  accordionList.className = 'p-accordion__list';

  accordion.appendChild(accordionList);

  // Process headings to create hierarchical sections
  let sections = [];
  let currentH1Section = null;

  headings.forEach(function(heading) {
    // Skip any "Contents" or "Table of Contents" heading
    if (heading.textContent.trim() === 'Contents' || heading.textContent.trim() === 'Table of Contents') return;

    // Create ID from heading text if it doesn't have one
    if (!heading.id) {
      const id = heading.textContent.toLowerCase()
        .replace(/[^\w\s-]/g, '')   // Remove special chars
        .replace(/\s+/g, '-')       // Replace spaces with hyphens
        .replace(/-+/g, '-');       // Replace multiple hyphens with single
      heading.id = id;
    }

    if (heading.tagName.toLowerCase() === 'h1') {
      // Create a new h1 section
      currentH1Section = {
        title: heading.textContent,
        id: heading.id,
        subheadings: []
      };
      sections.push(currentH1Section);
    } else if (heading.tagName.toLowerCase() === 'h2' && currentH1Section) {
      // Add h2 as a subheading to the current h1 section
      currentH1Section.subheadings.push({
        title: heading.textContent,
        id: heading.id
      });
    }
    // We're ignoring h3 for now to keep the TOC cleaner
  });

  // Create TOC with accordion structure
  sections.forEach(function(section, index) {
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
    // All sections closed by default except the first one
    accordionTab.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
    accordionTab.textContent = section.title;

    accordionHeading.appendChild(accordionTab);
    accordionGroup.appendChild(accordionHeading);

    // Create panel
    const accordionPanel = document.createElement('section');
    accordionPanel.className = 'p-accordion__panel';
    accordionPanel.id = accordionId + '-panel';
    accordionPanel.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
    accordionPanel.setAttribute('aria-labelledby', accordionId);

    // Add links to subheadings or the main heading
    if (section.subheadings.length > 0) {
      const subList = document.createElement('ul');
      subList.className = 'toc-subheadings';

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

  // Add the accordion to the TOC container
  tocContainer.appendChild(accordion);

  // Setup accordion functionality
  function toggleExpanded(element, show) {
    var target = document.getElementById(element.getAttribute('aria-controls'));

    if (target) {
      element.setAttribute('aria-expanded', show);
      target.setAttribute('aria-hidden', !show);
    }
  }

  function setupAccordion(accordionContainer) {
    // Set up an event listener on the container
    accordionContainer.addEventListener('click', function(event) {
      let target = event.target;

      // Find the closest accordion tab
      if (target.closest) {
        target = target.closest('.p-accordion__tab');
      }

      if (target) {
        // Check if already open
        const isTargetOpen = target.getAttribute('aria-expanded') === 'true';

        // Toggle the clicked panel
        toggleExpanded(target, !isTargetOpen);
      }
    });
  }

  // Initialize all accordions
  setupAccordion(accordion);
});

// Handle active link highlighting on scroll
window.addEventListener('scroll', function() {
  // Debounce for performance
  if (this.scrollTimeout) clearTimeout(this.scrollTimeout);

  this.scrollTimeout = setTimeout(function() {
    // Find all heading elements that have IDs
    const headings = document.querySelectorAll('h1[id], h2[id]');

    // Find which one is currently at the top of the viewport
    let current = '';
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const rect = heading.getBoundingClientRect();

      // If the heading is in the viewport or just above it
      if (rect.top <= 100) {
        current = heading.id;
      } else {
        // Once we find a heading below the viewport, we can stop
        break;
      }
    }

    // Find the link in the accordion that corresponds to the current heading
    if (current) {
      const links = document.querySelectorAll('.p-accordion__panel a');
      links.forEach(link => {
        // Remove highlighting from all links
        link.style.fontWeight = 'normal';

        // If this link points to the current heading, highlight it
        if (link.getAttribute('href') === '#' + current) {
          link.style.fontWeight = 'bold';

          // Find and expand the parent accordion if it's collapsed
          const panel = link.closest('.p-accordion__panel');
          if (panel) {
            const accordionId = panel.getAttribute('aria-labelledby');
            if (accordionId) {
              const accordionTab = document.getElementById(accordionId);
              if (accordionTab && accordionTab.getAttribute('aria-expanded') === 'false') {
                accordionTab.click();
              }
            }
          }
        }
      });
    }
  }, 100);
});
