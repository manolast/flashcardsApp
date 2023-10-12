window.addEventListener('load', main);

function main(){
    const buttonsStart = document.getElementsByClassName('button-start');
    Array.from(buttonsStart).forEach(button => {
        button.addEventListener('click', startNow);
    });
}


function startNow(){
    console.log("SAPE");
}
// Get the buttons and set initial state
const annualButton = document.getElementById("annualButton");
const monthlyButton = document.getElementById("monthlyButton");
let isAnnual = true;
const toggleSpan = document.getElementById("toggleSpan");

// Function to update button styles
function updateButtonStyles() {
  if (isAnnual) {
    annualButton.classList.add("active");
    monthlyButton.classList.remove("active");
    toggleSpan.classList.add("translate-x-0");
    toggleSpan.classList.remove("translate-x-full");

    Array.from(document.getElementsByClassName('monthly-text')).forEach(element => {
      element.classList.toggle('d-none');
    });
    Array.from(document.getElementsByClassName('yearly-text')).forEach(element => {
      element.classList.toggle('d-none');
    });
  } else {
    annualButton.classList.remove("active");
    monthlyButton.classList.add("active");
    toggleSpan.classList.remove("translate-x-0");
    toggleSpan.classList.add("translate-x-full");

    Array.from(document.getElementsByClassName('monthly-text')).forEach(element => {
      element.classList.toggle('d-none');
    });
    Array.from(document.getElementsByClassName('yearly-text')).forEach(element => {
      element.classList.toggle('d-none');
    });
  }
}

// Toggle between annual and monthly
annualButton.addEventListener("click", () => {
  isAnnual = true;
  updateButtonStyles();
});

monthlyButton.addEventListener("click", () => {
  isAnnual = false;
  updateButtonStyles();
});

// Initialize button styles
updateButtonStyles();


