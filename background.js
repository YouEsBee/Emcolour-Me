chrome.action.onClicked.addListener(() => {
    // Trigger the content script to analyze images
    chrome.scripting.executeScript({
      target: { tabId: chrome.activeTab.id },
      function: () => {
        // Content script logic to analyze images and apply filters
      }
    });
  });