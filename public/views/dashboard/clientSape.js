const dropArea = document.getElementById('drop-area');
const chooseFileLink = document.getElementById('idChooseFileLink');
const fileInput = document.getElementById('idFileInput');
const dropzoneSuccess = document.getElementById('dropzone-success');
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

      dropzoneSuccess.style.display = 'block';
      uploadedFileLabel.innerText = file.name;
      dropzoneText.style.display = 'none';



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

// let myDropzone = new Dropzone("form#my-awesome-dropzone", { url: "/file/post", acceptedFiles: 'pdf', maxFiles: 1});