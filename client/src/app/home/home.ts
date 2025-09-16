import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  flashcards: any[] = [
    {
      "_id": "685b00c017a89b9dd6244760",
      "title": "roba",
      "question": "domanda",
      "answer": "risposta",
      "subject_id": {
        "_id": "685ae3694d2b9c0a0a0cd9bf",
        "name": "Matematica",
        "icon": "685ae3694d2b9c0a0a0cd9bd",
        "desc": "Materia 3a superiore",
        "__v": 0
      },
      "question_img_id": "685b00c017a89b9dd624475c",
      "answer_img_id": "685b00c017a89b9dd624475e",
      "createdAt": "2025-06-24T19:47:12.076Z",
      "updatedAt": "2025-06-24T19:47:12.076Z",
      "__v": 0
    },
    {
      "_id": "685aefe8ff785b367cffa791",
      "title": "Esercizio addizioni",
      "question": "Quanto fa 2+2?",
      "answer": "2+2=4",
      "createdAt": "2025-06-24T18:35:20.434Z",
      "updatedAt": "2025-06-24T18:35:20.434Z",
      "__v": 0
    },
    {
      "_id": "685ad8365b46c58d73b59ee1",
      "title": "Immagini a caso",
      "question": "Che immagine è?",
      "answer": "Sono io",
      "question_img_id": "685ad8365b46c58d73b59edd",
      "answer_img_id": "685ad8365b46c58d73b59edf",
      "createdAt": "2025-06-24T16:54:14.511Z",
      "updatedAt": "2025-06-24T16:54:14.511Z",
      "__v": 0
    },
    {
      "_id": "685ad80e5b46c58d73b59edb",
      "title": "Esercizio addizioni",
      "question": "Quanto fa 2+2?",
      "answer": "2+2=4",
      "question_img_id": "685ad80e5b46c58d73b59ed7",
      "answer_img_id": "685ad80e5b46c58d73b59ed9",
      "createdAt": "2025-06-24T16:53:34.451Z",
      "updatedAt": "2025-06-24T16:53:34.451Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d374",
      "title": "Esercizio integrali",
      "question": "l'integrale di 2x?",
      "answer": "x^2",
      "subject_id": {
        "_id": "685962a35ae7102f85767b71",
        "name": "Matematica",
        "__v": 0,
        "desc": "Matematica 2o anno liceo",
        "icon": null
      },
      "createdAt": "2025-06-23T17:11:40.318Z",
      "updatedAt": "2025-06-23T17:11:40.318Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d371",
      "title": "Esercizio integrali",
      "question": "l'integrale di 2x?",
      "answer": "x^2",
      "subject_id": {
        "_id": "685962a35ae7102f85767b71",
        "name": "Matematica",
        "__v": 0,
        "desc": "Matematica 2o anno liceo",
        "icon": null
      },
      "createdAt": "2025-06-23T17:11:40.316Z",
      "updatedAt": "2025-06-23T17:11:40.316Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d36e",
      "title": "zero on reference",
      "question": "Che cosa è?",
      "answer": "E' un operazione che può essere implementata dalla CoW. Di base, se io voglio estendere lo stack o voglio scrivere sullo heap, il S.O. dà exception, nel caso della zero on reference, il S.O. riconosce il motivo dell'exception e ritorna la porzione di memoria richiesta azzerata (solamente se è stata richiesta la lettura di quella porzione, dato che è un meccanismo costoso da implementare). La memoria viene azzerata per motivi di sicurezza, altrimenti potrebbero esserci dei data leak di altri processi",
      "group_id": {
        "_id": "685962a35ae7102f85767b79",
        "name": "Address translation",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#2b6cb0"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.315Z",
      "updatedAt": "2025-06-23T17:11:40.315Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d36a",
      "title": "WT",
      "question": "Cosa è la policy di write through?",
      "answer": "La policy di write through riguarda i cache hits e funziona così:\nQuando c'è da fare una write, la scrive sia sulla cache sia sul successivo livello di memoria.\nQuesta soluzione è molto sempice da implementare e garantisce fin da subito la coerenza dei dati nei due livelli consecutivi.\nCome contro abbiamo che a velocità di scrittura dipende dalla velocità di scrittura del livelo più basso, e se ci sono più write da fare si può generare molto traffico",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.312Z",
      "updatedAt": "2025-06-23T17:11:40.312Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d366",
      "title": "Write invalidate protocol",
      "question": "Cosa è?",
      "answer": "È un protocollo di invalidazione usato per risolvere il problema di coerenza. Assegna uno stato alle variabili presenti nella cache, che può essere esclusivo, condiviso, modificato, e quando viene modificato un dato condiviso in altri core viene inviato un segnale di invalidazione alle altre cache che condividevano il dato",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.309Z",
      "updatedAt": "2025-06-23T17:11:40.309Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d362",
      "title": "Working set",
      "question": "Che cosa è?",
      "answer": "Un working set è un set di dati che accediamo regolarmente in un determinato lasso di tempo",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.307Z",
      "updatedAt": "2025-06-23T17:11:40.307Z",
      "__v": 0
    }
  ];
  seeAnswer(card_title, card_container_id = "cards_container") {
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

fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}
}

/* return della flashcard/getall
{
  "result": [
    {
      "_id": "685b00c017a89b9dd6244760",
      "title": "roba",
      "question": "domanda",
      "answer": "risposta",
      "subject_id": {
        "_id": "685ae3694d2b9c0a0a0cd9bf",
        "name": "Matematica",
        "icon": "685ae3694d2b9c0a0a0cd9bd",
        "desc": "Materia 3a superiore",
        "__v": 0
      },
      "question_img_id": "685b00c017a89b9dd624475c",
      "answer_img_id": "685b00c017a89b9dd624475e",
      "createdAt": "2025-06-24T19:47:12.076Z",
      "updatedAt": "2025-06-24T19:47:12.076Z",
      "__v": 0
    },
    {
      "_id": "685aefe8ff785b367cffa791",
      "title": "Esercizio addizioni",
      "question": "Quanto fa 2+2?",
      "answer": "2+2=4",
      "createdAt": "2025-06-24T18:35:20.434Z",
      "updatedAt": "2025-06-24T18:35:20.434Z",
      "__v": 0
    },
    {
      "_id": "685ad8365b46c58d73b59ee1",
      "title": "Immagini a caso",
      "question": "Che immagine è?",
      "answer": "Sono io",
      "question_img_id": "685ad8365b46c58d73b59edd",
      "answer_img_id": "685ad8365b46c58d73b59edf",
      "createdAt": "2025-06-24T16:54:14.511Z",
      "updatedAt": "2025-06-24T16:54:14.511Z",
      "__v": 0
    },
    {
      "_id": "685ad80e5b46c58d73b59edb",
      "title": "Esercizio addizioni",
      "question": "Quanto fa 2+2?",
      "answer": "2+2=4",
      "question_img_id": "685ad80e5b46c58d73b59ed7",
      "answer_img_id": "685ad80e5b46c58d73b59ed9",
      "createdAt": "2025-06-24T16:53:34.451Z",
      "updatedAt": "2025-06-24T16:53:34.451Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d374",
      "title": "Esercizio integrali",
      "question": "l'integrale di 2x?",
      "answer": "x^2",
      "subject_id": {
        "_id": "685962a35ae7102f85767b71",
        "name": "Matematica",
        "__v": 0,
        "desc": "Matematica 2o anno liceo",
        "icon": null
      },
      "createdAt": "2025-06-23T17:11:40.318Z",
      "updatedAt": "2025-06-23T17:11:40.318Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d371",
      "title": "Esercizio integrali",
      "question": "l'integrale di 2x?",
      "answer": "x^2",
      "subject_id": {
        "_id": "685962a35ae7102f85767b71",
        "name": "Matematica",
        "__v": 0,
        "desc": "Matematica 2o anno liceo",
        "icon": null
      },
      "createdAt": "2025-06-23T17:11:40.316Z",
      "updatedAt": "2025-06-23T17:11:40.316Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d36e",
      "title": "zero on reference",
      "question": "Che cosa è?",
      "answer": "E' un operazione che può essere implementata dalla CoW. Di base, se io voglio estendere lo stack o voglio scrivere sullo heap, il S.O. dà exception, nel caso della zero on reference, il S.O. riconosce il motivo dell'exception e ritorna la porzione di memoria richiesta azzerata (solamente se è stata richiesta la lettura di quella porzione, dato che è un meccanismo costoso da implementare). La memoria viene azzerata per motivi di sicurezza, altrimenti potrebbero esserci dei data leak di altri processi",
      "group_id": {
        "_id": "685962a35ae7102f85767b79",
        "name": "Address translation",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#2b6cb0"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.315Z",
      "updatedAt": "2025-06-23T17:11:40.315Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d36a",
      "title": "WT",
      "question": "Cosa è la policy di write through?",
      "answer": "La policy di write through riguarda i cache hits e funziona così:\nQuando c'è da fare una write, la scrive sia sulla cache sia sul successivo livello di memoria.\nQuesta soluzione è molto sempice da implementare e garantisce fin da subito la coerenza dei dati nei due livelli consecutivi.\nCome contro abbiamo che a velocità di scrittura dipende dalla velocità di scrittura del livelo più basso, e se ci sono più write da fare si può generare molto traffico",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.312Z",
      "updatedAt": "2025-06-23T17:11:40.312Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d366",
      "title": "Write invalidate protocol",
      "question": "Cosa è?",
      "answer": "È un protocollo di invalidazione usato per risolvere il problema di coerenza. Assegna uno stato alle variabili presenti nella cache, che può essere esclusivo, condiviso, modificato, e quando viene modificato un dato condiviso in altri core viene inviato un segnale di invalidazione alle altre cache che condividevano il dato",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.309Z",
      "updatedAt": "2025-06-23T17:11:40.309Z",
      "__v": 0
    },
    {
      "_id": "68598acc331a22259944d362",
      "title": "Working set",
      "question": "Che cosa è?",
      "answer": "Un working set è un set di dati che accediamo regolarmente in un determinato lasso di tempo",
      "group_id": {
        "_id": "685962a35ae7102f85767b7b",
        "name": "Gerarchie di memoria",
        "subject_id": "685962a35ae7102f85767b73",
        "__v": 0,
        "color": "#ffdd00"
      },
      "subject_id": {
        "_id": "685962a35ae7102f85767b73",
        "name": "AESO",
        "__v": 0,
        "desc": "Architetture e Sistemi Operativi"
      },
      "createdAt": "2025-06-23T17:11:40.307Z",
      "updatedAt": "2025-06-23T17:11:40.307Z",
      "__v": 0
    }
  ],
  "count": 491
}*/
