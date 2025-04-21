let cards_arr = [];
let group_arr = [];
let i=0;

async function seeAnswer(card_title, card_container_id = "cards_container") {
  card_title = decodeURIComponent(card_title);
  const cards = document.getElementById(card_container_id).children;
  Array.from(cards).forEach(card=>{
    if (card.querySelector('.card-title').textContent === card_title) {
      const cardData = cards_arr.find(c => c.title === card_title);
  
      // Cambia il contenuto del card-description con la risposta
      if (cardData) {
        const card_text_selector=card.querySelector('.card-text')
        if(card_text_selector.textContent == cardData.answer){
          card.querySelector('.card-text').textContent = cardData.question;
          card.querySelector('.card-button').textContent = "Vedi risposta";

        }else{
          card.querySelector('.card-text').textContent = cardData.answer;
          card.querySelector('.card-button').textContent = "Vedi domanda";
        }
      }
    }
  })
}

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

/**
 * 
 * @param {CallableFunction} card_str_call callback to get card str
 * @param {string} card_container_id name of the id of cards' container
 */
async function loadFlashcard(card_str_call, card_container_id = "cards_container", filter_group = "", max_num = "", sort=false) {
  try {
    const response = await fetch('/flashcards.json');
    let flashcardsData = await response.json();

    const response2 = await fetch('/groups.json');
    const groupsData = await response2.json();

    // se è stato richiesto il sorting lo esegue prima della filter
    if(sort)
      flashcardsData.sort(() => Math.random() - 0.5);

    // Filtro per gruppo
    if (filter_group !== "") {
      flashcardsData = flashcardsData.filter(card => card.group === filter_group);
    }
    
    // Se specificato, riduci il numero massimo
    if (max_num !== "" && max_num < flashcardsData.length) {
      flashcardsData = flashcardsData.slice(0, max_num);
    }

    // Controlla se ci sono card da mostrare
    const container = document.getElementById(card_container_id);
    if (!flashcardsData.length) {
      container.innerHTML = `<h2> Error: no card found in the group selected</h2>`;
      return;
    }

    let htmlstr = "";
    flashcardsData.forEach(card => {
      const group = groupsData.find(g => card.group === g.name);
      const color = group ? group.color : "#007bff";
      htmlstr += card_str_call(card, color);
      cards_arr.push(card); // Se ti serve un array globale con le card caricate
      i++;
    });

    container.innerHTML = htmlstr;
    i=0;
  } catch (error) {
    console.error('Errore nella lettura del file:', error);
  }
}

async function getFlashcard(card_title) {
  console.log("card title", card_title)
  try {
    const response = await fetch('/data/flashcards.json');
    let flashcardsData = await response.json();

    return flashcardsData.filter(card => card.title === card_title)[0]; // TODO cambiarlo in un id
  } catch (error) {
    console.error('Errore nella lettura del file:', error);
  }
}

async function copyCard(card_title){
  card_title = decodeURIComponent(card_title);
  const flashcard = await getFlashcard(card_title);
  console.log("flashcard filtered", flashcard)
  const string_to_copy = `Question: ${flashcard.question}\nAnswer: ${flashcard.answer}`;
  try {
    await navigator.clipboard.writeText(string_to_copy);
    alert('Content copied to clipboard'); // TODO aggiungere un toast invece che un alert
  } catch (err) {
    alert('Failed to copy');
    console.error(err);
  }
}

async function loadGroups(group_id='group'){
  let select = document.getElementById(group_id);
  
  let res = await fetch('/data/groups.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const groupsData = await res.json();
  groupsData.forEach(group=>{
    select.innerHTML+= `<option value="${group.name}">${group.name}</option>`
  })
}

const createIndexCard = ((card, color)=>`
  <div class="card h-100 col-md-4">
    <div class="card-body custom-card">
      <div class="colorful-card-title" style="background-color: ${color} !important">
        <h5 class="card-title">${card.title}</h5>
      </div>
      <div class="card-body-custom">
        <p class="card-text text-wrap-custom">${card.question}</p>
        <div class="mt-auto">
          <button class="btn btn-primary card-button me-2" onclick="seeAnswer('${fixedEncodeURIComponent(card.title)}')">Vedi risposta</button>
          <button type="button" class="btn btn-danger card-button" onclick="deleteCard('${fixedEncodeURIComponent(card.title)}')">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
              <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
            </svg>
          </button>
          <button type="button" class="btn btn-warning card-button" onclick="modifyCard(
              '${fixedEncodeURIComponent(card.title)}',
              '${fixedEncodeURIComponent(card.answer)}',
              '${fixedEncodeURIComponent(card.question)}',
              '${fixedEncodeURIComponent(card.group || '')}'
          )">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>  
          </button>
          <button type="button" class="btn btn-success card-button" onclick="copyCard('${fixedEncodeURIComponent(card.title)}')">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>`)

const createTestCard = ((card, color)=>`
  <div class="card mb-4 mt-4">
    <div class="card-body custom-card d-flex flex-column" style="padding-top:0px;">
      <div class="colorful-card-title" style="background-color: ${color} !important">
        <h5 class="card-title">${card.title}</h5>
      </div>
      <div class="card-body-custom">
        <p class="card-text">${card.question}</p>
        <div class="mt-auto">
          <button class="btn btn-primary card-button me-2" onclick="seeAnswer('${card.title}')">Vedi risposta</button>
          <div class="d-flex justify-content-start container-radio">
            <div class="icon-wrapper me-2" onclick="toggleSelection(${i}, 'incorrect')">
              <svg id="incorrect-icon-${i}" class="unselected-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#EA3323">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
              </svg>
            </div>
            <div class="icon-wrapper" onclick="toggleSelection(${i}, 'correct')">
              <svg id="correct-icon-${i}" class="unselected-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#75FB4C">
                <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`)

function textAreaAutoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  textarea.style.overflowY = "hidden";
}