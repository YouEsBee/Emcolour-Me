document.addEventListener('DOMContentLoaded', () => {



    // ============== Settings open and close ==================
    const settingsButton = document.getElementById('openSettings'); // Settings button
    const settingsPanel = document.getElementById('settings'); // Settings panel

    // Simple toggle function for the settings panel visibility
    settingsButton.addEventListener('click', () => {
        // Toggle visibility of settings panel
        if (settingsPanel.style.display === 'block') {
            settingsPanel.style.display = 'none'; // Hide the settings panel
        } else {
            settingsPanel.style.display = 'block'; // Show the settings panel
        }
    });
    // =========================================================

    // ================= Get prev colour deficiency option chosen by user =================
    chrome.storage.sync.get('colorDeficiency', (data) => {
        const deficiency = data.colorDeficiency || 'none';
        document.getElementById('deficiencyDisplay').innerText = deficiency;

        const radioButtons = document.getElementsByName('deficiency');
        radioButtons.forEach(radio => {
            if (radio.value === deficiency) {
                radio.checked = true;
            }
        });
    });
    // ===================================================================================

    // =========== Get previous preference if user wants colour overlay or not ============
    const checkbox = document.querySelector('#overlayCheckbox');

    chrome.storage.sync.get('checkboxState', (data) => {
        if (data.checkboxState !== undefined) {
            checkbox.checked = data.checkboxState; // data.checkboxState returns boolean
        }
    });
    // ==================================================================================

    // ================= Save checkbox state when changed =================
    checkbox.addEventListener('change', () => {
        chrome.storage.sync.set({ checkboxState: checkbox.checked }, () => {
            console.log('Checkbox state saved:', checkbox.checked);
        });
    });
    // ====================================================================

    // ================= Get the checkbox state as a Promise ====================
    function getCheckboxState() {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get('checkboxState', (data) => {
                if (data.checkboxState !== undefined) {
                    resolve(data.checkboxState);
                } else {
                    reject('No checkbox state found');
                }
            });
        });
    }
    // ========================================================================================

    
    // ================================== Filter Strength ==================================
    // Initialize filter strength. 0.8 by default
    let filterStrength = 0.8;

    // Strength of filter slider with debounce
    const slider = document.querySelector('.strength-control input');
    slider.addEventListener('input', (e) => {
        filterStrength = e.target.value / 100; // convert percentage to decimal
    });
    // =====================================================================================


    // ================= action for remove filter button =================
    document.getElementById('removeFilter').addEventListener('click', () => {
        // change loading text to tell user colour application is being removed
        document.getElementById('loadingText').innerText = "Status: Removing...";
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const images = document.querySelectorAll('img');
    
                        // Reset all images to original state
                        images.forEach(img => {
                            if (img.dataset.originalSrc) {
                                img.src = img.dataset.originalSrc; // Reset to original source
                            }
                        });

                        // Remove any previous overlays
                        const existingOverlays = document.querySelectorAll('[data-overlay="true"]');
                        existingOverlays.forEach(overlay => {
                            overlay.remove();
                        });
                    }
                });
            };
        });
        // change loading text to tell user colour application is removed
        document.getElementById('loadingText').innerText = "Status: Removed.";
    });
    // ====================================================================


    // ================= When applyFilter is clicked =================
    document.getElementById('applyFilter').addEventListener('click', async () => {
        // change loading text to tell user colour application is loading
        document.getElementById('loadingText').innerText = "Status: Loading...";

        // create a const to refer to the type of colour deficiency chosen
        const deficiency = document.getElementById('deficiencyDisplay').innerText;

        // sleep function
        function sleep(ms){
            return new Promise((r) => {
              setTimeout(r, ms)
            })
          }

        // Get checkbox state and execute the main functionality once it's available
        try {
            const selectedBox = await getCheckboxState();  // Wait for the Promise to resolve

            // Delay cause it's async
            await sleep(100);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        func: async (deficiency, filterStrength, selectedBox) => {
                            // =============== Main built-in colour filter ===================
                            const images = document.querySelectorAll('img');
                
                            // Reset all images to original state
                            images.forEach(img => {
                                if (img.dataset.originalSrc) {
                                    img.src = img.dataset.originalSrc; // Reset to original source
                                }
                            });

                            if (deficiency === 'none') {
                                return; // Exit early if 'none' is selected
                            }

                            images.forEach(img => {
                                delete img.dataset.processed; // Clean up processed flag
                                delete img.dataset.originalSrc; // Clean up original source
                            });

                            function applyColorTransformations(img, deficiency) {
                                if (!img.dataset.originalSrc) {
                                    img.dataset.originalSrc = img.src; // Store original source
                                }
                                
                                // Create a new image with the new colours
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = img.naturalWidth; // ensure image has same dimensions as original
                                canvas.height = img.naturalHeight;
                                ctx.drawImage(img, 0, 0);
                    
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                const data = imageData.data;

                                // Extract colour in RGB and transform their values
                                for (let i = 0; i < data.length; i += 4) {
                                    const r = data[i];
                                    const g = data[i + 1];
                                    const b = data[i + 2];

                                    const original = { r, g, b };
                                    let transformed;

                                    // Apply transformations based on deficiency
                                    if (deficiency === 'red-green') {
                                        transformed = {
                                            r: 0.567 * r + 0.433 * g,
                                            g: 0.558 * r + 0.442 * g,
                                            b: 0.242 * r + 0.758 * b
                                        };
                                    } else if (deficiency === 'green-red') {
                                        transformed = {
                                            r: 0.625 * r + 0.375 * g,
                                            g: 0.7 * r + 0.3 * g,
                                            b: 0.3 * r + 0.7 * b
                                        };
                                    } else if (deficiency === 'blue-yellow') {
                                        transformed = {
                                            r: 0.95 * r + 0.05 * b,
                                            g: 0.433 * g + 0.567 * b,
                                            b: 0.475 * g + 0.525 * b
                                        };
                                    }
                                    
                                    // if deficiency is not none, apply filter and strength
                                    if (deficiency !== 'none') {
                                        data[i] = original.r * (1 - filterStrength) + transformed.r * filterStrength;
                                        data[i + 1] = original.g * (1 - filterStrength) + transformed.g * filterStrength;
                                        data[i + 2] = original.b * (1 - filterStrength) + transformed.b * filterStrength;
                                    }
                                    
                                }
                            
                                ctx.putImageData(imageData, 0, 0);
                                img.src = canvas.toDataURL(); // Set new image source
                                img.dataset.processed = true; // Mark the image as processed
                            }

                            // Apply the selected filter only if deficiency is not 'none'
                            if (deficiency !== 'none') {
                                images.forEach(img => {
                                    img.crossOrigin = 'Anonymous'; // Enable CORS

                                    if (!img.dataset.processed) {
                                        if (img.complete) {
                                            applyColorTransformations(img, deficiency);
                                        } else {
                                            img.onload = () => {
                                                if (!img.dataset.processed) {
                                                    applyColorTransformations(img, deficiency);
                                                }
                                            };
                                        }
                                    }
                                });
                            }
                            // ================ End of main built-in colour filter ==================


                            // ==================== GEMINI Color Overlay from AI =======================

                            if (selectedBox === true) {
                                // AI interaction part
                                const session = await ai.languageModel.create({
                                    systemPrompt: "You are a program designed to help colour-deficient users to see images better. Suggest a colour filter at an appropriate opacity of between 0 and 0.5 in 1 decimal place with the incoming prompt. The colours of the image are currently already inverted. But you are tasked to make it even better. I don't need any explanation. Provide response in the colour code, R: <color_no>; G: <color_no>; B: <color_no>; Opacity: <opacity_no>"
                                });

                                // Get the AI's reply to the colour deficiency chosen
                                const reply = await session.prompt(`Filter for ${deficiency} colour deficiency`);
                                console.log(reply);  // Example output: "R: 255; G: 100; B: 100; Opacity: 0.5"

                                // Parse the RGB and opacity values from the AI response
                                const colorMatch = reply.match(/R:\s*(\d+)\s*;\s*G:\s*(\d+)\s*;\s*B:\s*(\d+)\s*;?\s*Opacity:\s*(\d*\.?\d+)/);
                                if (colorMatch) {
                                    const [_, r, g, b, opacity] = colorMatch;
                                    const overlayColor = `rgba(${r}, ${g}, ${b}, ${opacity})`; // RGB with dynamic opacity

                                    // Remove any previous overlays
                                    const existingOverlays = document.querySelectorAll('[data-overlay="true"]');
                                    existingOverlays.forEach(overlay => {
                                        overlay.remove();
                                    });

                                    // Create overlay for each image
                                    images.forEach(img => {
                                        const overlay = document.createElement('div');
                                        overlay.style.position = 'absolute';
                                        overlay.style.top = '0';
                                        overlay.style.left = '0';
                                        overlay.style.width = '100%';
                                        overlay.style.height = '100%';
                                        overlay.style.backgroundColor = overlayColor;
                                        overlay.style.pointerEvents = 'none';  // Prevent overlay from blocking interactions
                                        overlay.setAttribute('data-overlay', 'true');  // Mark the overlay

                                        // Ensure the image is wrapped in a relative container
                                        let wrapper = img.parentElement;
                                        if (!wrapper || wrapper.style.position !== 'relative') {
                                            wrapper = document.createElement('div');
                                            wrapper.style.position = 'relative';
                                            img.parentNode.insertBefore(wrapper, img);
                                            wrapper.appendChild(img);
                                        }

                                        // Add the color overlay to the wrapper
                                        wrapper.appendChild(overlay);
                                    });
                                }

                                // gemini explains
                                const explainGemini = await session.prompt(`Why did you choose this colour overlay? Explain it in layman terms with a short sentence.`);
                                alert(`Gemini: ${explainGemini}`);

                            } else if (selectedBox === false) {
                                // if unchecked, just return nothing
                                return;
                            }

                            // ================== End of color overlay ==========================
                        },
                        args: [deficiency, filterStrength, selectedBox]
                    });
                } else {
                    console.error("No active tab found.");
                }
            });

        } catch (error) {
            // If there is any error (Promise is rejected), handle it here
            console.error('Error fetching checkbox state:', error);
            alert('Error fetching checkbox state: ' + error);
        }
        
        // change loading text to tell user colour is applied
        document.getElementById('loadingText').innerText = "Status: Applied.";
    });
    // ====================================================================
    

    // ================= When Save btn is clicked =================
    document.getElementById('saveSetting').addEventListener('click', () => {
        // Save deficiency option chosen
        const radioButtons = document.getElementsByName('deficiency');
        let newDeficiency;
        radioButtons.forEach(radio => {
            if (radio.checked) {
                newDeficiency = radio.value;
            }
        });

        if (newDeficiency) {
            chrome.storage.sync.set({ colorDeficiency: newDeficiency }, () => {
                document.getElementById('deficiencyDisplay').innerText = newDeficiency;
                document.getElementById('settings').style.display = 'none';
            });
        }
    });
    // ====================================================================

});
