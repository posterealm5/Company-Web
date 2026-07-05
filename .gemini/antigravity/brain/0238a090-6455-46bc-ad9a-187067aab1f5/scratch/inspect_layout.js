import http from 'node:http';

async function getCDPUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          const pageTarget = targets.find(t => t.type === 'page');
          if (pageTarget) {
            resolve(pageTarget.webSocketDebuggerUrl);
          } else {
            reject(new Error('No page target found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sendCDPMessage(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  const message = JSON.stringify({ id, method, params });
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.id === id) {
        ws.removeEventListener('message', onMessage);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      }
    };
    ws.addEventListener('message', onMessage);
    ws.send(message);
  });
}

async function main() {
  try {
    console.log("Fetching CDP WebSocket URL...");
    const wsUrl = await getCDPUrl();
    console.log("Connecting to CDP WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    console.log("Connected to CDP!");

    console.log("Enabling Page domain...");
    await sendCDPMessage(ws, 'Page.enable');

    console.log("Navigating to http://localhost:3000/collections...");
    await sendCDPMessage(ws, 'Page.navigate', { url: 'http://localhost:3000/collections' });

    // Wait 5 seconds for page load and hydration
    console.log("Waiting for page load and assets...");
    await new Promise(r => setTimeout(r, 6000));

    // Execute DOM check script
    console.log("Executing DOM audit script...");
    const auditExpression = `(${auditDOM.toString()})()`;
    const response = await sendCDPMessage(ws, 'Runtime.evaluate', {
      expression: auditExpression,
      returnByValue: true,
      awaitPromise: true
    });

    console.log("\n=================== AUDIT RESULT ===================");
    console.log(JSON.stringify(response.result, null, 2));
    console.log("===================================================\n");

    ws.close();
  } catch (error) {
    console.error("Error running script:", error);
  }
}

async function auditDOM() {
  const result = {
    errors: [],
    scrollOffsets: {}
  };

  // Helper to get metrics
  function getElementInfo(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      tagName: el.tagName,
      className: el.className,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      offsetHeight: el.offsetHeight,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      offsetWidth: el.offsetWidth,
      scrollTop: el.scrollTop,
      getBoundingClientRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      },
      computedStyle: {
        display: style.display,
        position: style.position,
        top: style.top,
        transform: style.transform,
        overflow: style.overflow,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
        alignSelf: style.alignSelf,
        placeItems: style.placeItems,
        contain: style.contain,
        isolation: style.isolation,
        aspectRatio: style.aspectRatio,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        padding: style.padding,
        margin: style.margin
      }
    };
  }

  try {
    // 1. Locate first Quick Add button
    const quickAddBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Quick Add');
    if (quickAddBtns.length === 0) {
      result.errors.push("No Quick Add buttons found on collections page.");
      return result;
    }

    // Find Collection Card elements corresponding to that button
    let cardContainer = quickAddBtns[0];
    while (cardContainer && !cardContainer.querySelector('img')) {
      cardContainer = cardContainer.parentElement;
    }
    const cardImg = cardContainer ? cardContainer.querySelector('img') : null;
    if (cardImg) {
      const cardWrapper = cardImg.parentElement;
      result.collectionCard = {
        image: getElementInfo(cardImg),
        wrapper: getElementInfo(cardWrapper)
      };
    } else {
      result.errors.push("Collection card image not found next to Quick Add button.");
    }

    // Capture initial body scroll
    result.scrollOffsets.bodyBeforeOpen = document.documentElement.scrollTop || document.body.scrollTop;

    console.log("Clicking Quick Add button...");
    quickAddBtns[0].click();

    // Wait 1.5 seconds for modal animation and rendering
    await new Promise(r => setTimeout(r, 1500));

    // Capture scroll offset after modal open
    result.scrollOffsets.bodyAfterOpen = document.documentElement.scrollTop || document.body.scrollTop;

    // Locate modal image and wrappers
    const modalImg = document.querySelector('.fixed.inset-0 img');
    if (!modalImg) {
      result.errors.push("Modal product image not found inside .fixed.inset-0 container.");
      return result;
    }

    const modalImgWrapper = modalImg.parentElement;
    const modalWrapper = modalImg.closest('.relative.bg-brand-white') || modalImg.closest('.shadow-2xl');

    result.modalWrapper = getElementInfo(modalWrapper);
    result.pdp = {
      image: getElementInfo(modalImg),
      wrapper: getElementInfo(modalImgWrapper),
      imageLargerThanWrapper: (modalImg.naturalWidth > modalImgWrapper.clientWidth) || (modalImg.naturalHeight > modalImgWrapper.clientHeight)
    };

    // Check parent elements up to body
    result.parentChain = [];
    let parent = modalImgWrapper;
    while (parent && parent !== document.body) {
      result.parentChain.push({
        tagName: parent.tagName,
        className: parent.className,
        scrollTop: parent.scrollTop,
        scrollHeight: parent.scrollHeight,
        clientHeight: parent.clientHeight,
        style: {
          display: window.getComputedStyle(parent).display,
          position: window.getComputedStyle(parent).position,
          transform: window.getComputedStyle(parent).transform,
          overflow: window.getComputedStyle(parent).overflow,
          alignItems: window.getComputedStyle(parent).alignItems,
          alignSelf: window.getComputedStyle(parent).alignSelf,
          justifyContent: window.getComputedStyle(parent).justifyContent,
          placeItems: window.getComputedStyle(parent).placeItems,
          contain: window.getComputedStyle(parent).contain,
          isolation: window.getComputedStyle(parent).isolation
        }
      });
      parent = parent.parentElement;
    }

    // 3. Red Rectangle Test
    const wrapperWidth = modalImgWrapper.clientWidth;
    const wrapperHeight = modalImgWrapper.clientHeight;
    
    result.redRectangleTest = {
      wrapperWidth,
      wrapperHeight
    };

    // Create the red rectangle
    const redRect = document.createElement('div');
    redRect.id = 'temp-red-rect';
    redRect.style.width = wrapperWidth + 'px';
    redRect.style.height = wrapperHeight + 'px';
    redRect.style.backgroundColor = 'red';
    redRect.style.position = 'relative';
    redRect.style.zIndex = '100';

    // Hide image and insert rectangle
    modalImg.style.display = 'none';
    modalImgWrapper.appendChild(redRect);

    // Wait and measure
    await new Promise(r => setTimeout(r, 500));
    
    const rectBounding = redRect.getBoundingClientRect();
    const wrapperBounding = modalImgWrapper.getBoundingClientRect();

    result.redRectangleTest.rectBounding = {
      top: rectBounding.top,
      bottom: rectBounding.bottom,
      left: rectBounding.left,
      right: rectBounding.right,
      width: rectBounding.width,
      height: rectBounding.height
    };

    result.redRectangleTest.wrapperBounding = {
      top: wrapperBounding.top,
      bottom: wrapperBounding.bottom,
      left: wrapperBounding.left,
      right: wrapperBounding.right,
      width: wrapperBounding.width,
      height: wrapperBounding.height
    };

    // Check if the rectangle is clipped by the wrapper
    result.redRectangleTest.isClipped = (
      Math.abs(rectBounding.top - wrapperBounding.top) > 1 ||
      Math.abs(rectBounding.height - wrapperBounding.height) > 1 ||
      Math.abs(rectBounding.width - wrapperBounding.width) > 1
    );

    // Clean up red rectangle
    redRect.remove();
    modalImg.style.display = '';

  } catch (e) {
    result.errors.push(e.message + '\n' + e.stack);
  }

  return result;
}

main();
