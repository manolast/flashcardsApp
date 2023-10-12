window.addEventListener('load', start);

function start(){
  document.getElementById('idGenerateFlashcards').addEventListener('click', (e)=>{handleFile(e)})
  const buttonUpgrade =document.getElementById('idButtonUpgrade');
  if(buttonUpgrade){
    buttonUpgrade.addEventListener('click', upgradePlan);
  }
  const buttonDowngrade = document.getElementById('idButtonDowngrade');
  if(buttonDowngrade){
    buttonDowngrade.addEventListener('click', function(){
      fetch('/downgrade', {
        method: 'POST',
      })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error);
        }
        return response.json();
      })
      .then((data) => {
        alert(data.message);
      })
      .catch((error) => {
        console.error('Error:', error);
        const errorMessage = error.message || 'An error occurred.';
        message.innerText = errorMessage;
      });
    });
  }

  const dropArea = document.getElementById('drop-area');
  const chooseFileLink = document.getElementById('idChooseFileLink');
  const fileInput = document.getElementById('idFileInput');
  const dropzoneSuccess = document.getElementById('dropzone-success-upload');
  const dropzoneText = document.getElementById('dropzone-text');
  const uploadedFileLabel = document.getElementById('uploadedFileLabel');

  dropArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('dragover');
    dropArea.classList.remove('border');

  });

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('dragover');
    dropArea.classList.remove('border');

  });

  dropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('dragover');
  });

  fileInput.addEventListener('change', () => {
      if(fileInput.files.length>1){
        alert('insert only one file');
        fileInput.value = '';
        return;
      }
      const file = fileInput.files[0];
      if (file.type !== 'application/pdf') {
        alert("Only pdfs are allowed");
        fileInput.value = '';
        return;
      }

      dropzoneSuccess.classList.remove('d-none');
      uploadedFileLabel.innerText = file.name;
      dropzoneText.classList.add('d-none');



});
  
  // Handle dropped files
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  
    dropArea.classList.remove('dragover');

    const files = e.dataTransfer.files;

    if (files.length !== 1) {
      alert('Please upload only one file at a time.');
      return;
    }
  
    const file = files[0];
    
    // Check if the dropped file is a PDF
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed.');
    } else{

      let list = new DataTransfer();
      list.items.add(file);
      fileInput.files = list.files;

      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
    }
  });

  chooseFileLink.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  })

}

function handleFile (event){
  event.preventDefault();
  const message = document.getElementById('statusMessage');
  const form = document.getElementById('idUploadForm');
  if(form.reportValidity()){
    const fileInput = document.getElementById('idFileInput');
    const file = fileInput.files[0];

    const topicInput = document.getElementById('id-pdf-topic');
    const topic = topicInput.value;
    const formData = new FormData();
  
    formData.append('file', file);
    formData.append('topic', topic);

    document.getElementById('dropzone-success-upload').classList.toggle('d-none');
    document.getElementById('dropzone-charging').classList.toggle('d-none');
  
    fetch('/upload', {
      method: 'POST',
      body: formData, // Use the FormData object as the request body
    })
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
      return response.json();
    })
    .then((data) => {
      const downloadLink = document.getElementById('idDownloadLink');
      downloadLink.href = data.fileUrl;
      downloadLink.target = '_blank'; // Opens the link in a new tab
      downloadLink.download = 'your-generated-file-name-flashcards.txt';
      document.getElementById('dropzone-charging').classList.toggle('d-none');
      document.getElementById('dropzone-success-generation').classList.toggle('d-none');
      
      if(data.error === 'quota'){
        //quota exceeded popup
        alert('You exceeded your account limits, however a partial deck was generated.')
        downloadLink.innerText = 'download partial deck flashcards'
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      const errorMessage = error.message || 'An error occurred.';
      message.innerText = errorMessage;
    });

    fileInput.value = "";
    topicInput.value = '';

  }
};


function upgradePlan(){
  fetch('/upgrade', {
    method: 'POST',
    body: 'sape', // Use the FormData object as the request body
  })

  .then(response => response.json())
  .then(data => {
    if (data.message){
      alert(data.message + `\nPlease refresh this page to view changes.`)
    }
  })
  .catch((error) => {
    alert('An error ocurred. If this persists contact us at contact@flashstudy.tech.')
    console.error('Error:', error);
    const errorMessage = error.message || 'An error occurred.';
  });
}

function downgradePlan(){
  fetch('/downgrade', {
    method: 'POST',
    body: 'sape',
  })

  .then(response => response.json())
  .then(data => {
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    }else if(data.message){
      alert(message + `\nPlease refresh this page to view the changes.`);
    }
  })
  .catch((error) => {
    alert(`An error occured on downgrade. Try again.\n If this error persists, contact us at contact@flashstudy.tech`)
    console.error('Error:', error);
    const errorMessage = error.message || 'An error occurred.';
  });

}
