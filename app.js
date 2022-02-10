const express = require('express')
const app = express()
const port = 8080
var moment = require('moment-timezone');


app.get('/boleto/:tagId?', (req, res) => {
	try {
	  let boletoid = req.params.tagId;
	  
	  if(boletoid == undefined || boletoid == '' ) {
		  throw "Código não informado";
	  }
	  
	  let valid = boleto(boletoid);
	  let stcod;

	  const cod = clearMask(boletoid);
	  let fatorData = '';
	  let dataBoleto = moment.tz("1997-10-07 20:54:59.000Z", "UTC");
	  let valorBoleto;
	  let valorFinal;
	  let codigo = cod;
	  
	  if (Number(cod[0]) === 8) { //A
		if (cod.length === 44) {
			fatorData = '0';
			valorFinal = identificarValorCodBarrasArrecadacao(codigo, 'CODIGO_DE_BARRAS');

		} //CB
		else if (cod.length === 48) {
			fatorData = '0';
			valorFinal = identificarValorCodBarrasArrecadacao(codigo, 'LINHA_DIGITAVEL');

		} //L
	  } else { // B
		  if (cod.length === 44) {
			  fatorData = codigo.substr(5, 4);
			  valorBoleto = codigo.substr(9, 10);
				valorFinal = valorBoleto.substr(0, 8) + '.' + valorBoleto.substr(8, 2);

				let char = valorFinal.substr(1, 1);
				while (char === '0') {
					valorFinal = substringReplace(valorFinal, '', 0, 1);
					char = valorFinal.substr(1, 1);
				}
		  } //CB
		  else if (cod.length === 47)  {
			  fatorData = codigo.substr(33, 4);
			  valorBoleto = codigo.substr(37);
				valorFinal = valorBoleto.substr(0, 8) + '.' + valorBoleto.substr(8, 2);

				let char = valorFinal.substr(1, 1);
				while (char === '0') {
					valorFinal = substringReplace(valorFinal, '', 0, 1);
					char = valorFinal.substr(1, 1);
				}
		  } //L
	  }
	  
	  dataBoleto.add(Number(fatorData), 'days');

	  let dataVencimento = dataBoleto.toDate();
	  
	  let json = {
		  'barCode': cod,
		  'amount': valorFinal,
		  'expirationDate': dataVencimento
	  };
	  
	  res.status(valid?200:400).send(json);
  
	} catch(e) {
		let json = {
		  'barCode': '',
		  'amount': '',
		  'expirationDate': '',
		  'error': 'Código não informado'
	    }
		res.status(400).send(json);
	};
  
}
);

app.listen(port, () => {
  console.log(`App Boleto listening on port ${port}`)
})

function boleto(codigo, validarBlocos = false) {
  const cod = clearMask(codigo);
  if (Number(cod[0]) === 8) return boletoArrecadacao(cod, validarBlocos);
  return boletoBancario(cod, validarBlocos);
}

function clearMask(codigo) {
  return codigo.replace(/( |\.|-)/g, '');
}


function boletoBancarioCodigoBarras(codigo) {
  const cod = clearMask(codigo);
  if (!/^[0-9]{44}$/.test(cod)) return false;
  const DV = cod[4];
  const bloco = cod.substring(0, 4) + cod.substring(5);
  return modulo11Bancario(bloco) === Number(DV);
}

function boletoBancarioLinhaDigitavel(codigo, validarBlocos = false) {
  const cod = clearMask(codigo);
  if (!/^[0-9]{47}$/.test(cod)) return false;
  const blocos = [
    {
      num: cod.substring(0, 9),
      DV: cod.substring(9, 10),
    },
    {
      num: cod.substring(10, 20),
      DV: cod.substring(20, 21),
    },
    {
      num: cod.substring(21, 31),
      DV: cod.substring(31, 32),
    },
  ];
  const validBlocos = validarBlocos ? blocos.every(e => modulo10(e.num) === Number(e.DV)) : true;
  const validDV = boletoBancarioCodigoBarras(convertToBoletoBancarioCodigoBarras(cod));
  return validBlocos && validDV;
}

function boletoBancario(codigo, validarBlocos = false) {
  const cod = clearMask(codigo);
  if (cod.length === 44) return boletoBancarioCodigoBarras(cod);
  if (cod.length === 47) return boletoBancarioLinhaDigitavel(codigo, validarBlocos);
  return false;
}



 function modulo10(bloco) {
  const codigo = bloco.split('').reverse();
  const somatorio = codigo.reduce((acc, current, index) => {
    let soma = Number(current) * (((index + 1) % 2) + 1);
    soma = (soma > 9 ? Math.trunc(soma / 10) + (soma % 10) : soma);
    return acc + soma;
  }, 0);
  return (Math.ceil(somatorio / 10) * 10) - somatorio;
}


 function modulo11Bancario(bloco) {
  const codigo = bloco.split('').reverse();
  let multiplicador = 2;
  const somatorio = codigo.reduce((acc, current) => {
    const soma = Number(current) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
    return acc + soma;
  }, 0);
  const restoDivisao = somatorio % 11;
  const DV = 11 - restoDivisao;
  if (DV === 0 || DV === 10 || DV === 11) return 1;
  return DV;
}


 function modulo11Arrecadacao(bloco) {
  const codigo = bloco.split('').reverse();
  let multiplicador = 2;
  const somatorio = codigo.reduce((acc, current) => {
    const soma = Number(current) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
    return acc + soma;
  }, 0);
  const restoDivisao = somatorio % 11;

  if (restoDivisao === 0 || restoDivisao === 1) {
    return 0;
  }
  if (restoDivisao === 10) {
    return 1;
  }
  const DV = 11 - restoDivisao;
  return DV;
}

 function convertToBoletoArrecadacaoCodigoBarras(codigo) {
  const cod = clearMask(codigo);
  let codigoBarras = '';
  for (let index = 0; index < 4; index++) {
    const start = (11 * (index)) + index;
    const end = (11 * (index + 1)) + index;
    codigoBarras += cod.substring(start, end);
  }
  return codigoBarras;
}

 function convertToBoletoBancarioCodigoBarras(codigo) {
  const cod = clearMask(codigo);
  let codigoBarras = '';
  codigoBarras += cod.substring(0, 3); 
  codigoBarras += cod.substring(3, 4); 
  codigoBarras += cod.substring(32, 33); 
  codigoBarras += cod.substring(33, 37); 
  codigoBarras += cod.substring(37, 47); 
  codigoBarras += cod.substring(4, 9); 
  codigoBarras += cod.substring(10, 20); 
  codigoBarras += cod.substring(21, 31); 
  return codigoBarras;
}



 function boletoArrecadacaoCodigoBarras(codigo) {
  const cod = clearMask(codigo);
  if (!/^[0-9]{44}$/.test(cod) || Number(cod[0]) !== 8) return false;
  const codigoMoeda = Number(cod[2]);
  const DV = Number(cod[3]);
  const bloco = cod.substring(0, 3) + cod.substring(4);
  let modulo;
  if (codigoMoeda === 6 || codigoMoeda === 7) modulo = modulo10;
  else if (codigoMoeda === 8 || codigoMoeda === 9) modulo = modulo11Arrecadacao;
  else return false;
  return modulo(bloco) === DV;
}

 function boletoArrecadacaoLinhaDigitavel(codigo, validarBlocos = false) {
  const cod = clearMask(codigo);
  if (!/^[0-9]{48}$/.test(cod) || Number(cod[0]) !== 8) return false;
  const validDV = boletoArrecadacaoCodigoBarras(convertToBoletoArrecadacaoCodigoBarras(cod));
  if (!validarBlocos) return validDV;
  const codigoMoeda = Number(cod[2]);
  let modulo;
  if (codigoMoeda === 6 || codigoMoeda === 7) modulo = modulo10;
  else if (codigoMoeda === 8 || codigoMoeda === 9) modulo = modulo11Arrecadacao;
  else return false;
  const blocos = Array.from({ length: 4 }, (v, index) => {
    const start = (11 * (index)) + index;
    const end = (11 * (index + 1)) + index;
    return {
      num: cod.substring(start, end),
      DV: cod.substring(end, end + 1),
    };
  });
  const validBlocos = blocos.every(e => modulo(e.num) === Number(e.DV));
  return validBlocos && validDV;
}

 function boletoArrecadacao(codigo, validarBlocos = false) {
  const cod = clearMask(codigo);
  if (cod.length === 44) return boletoArrecadacaoCodigoBarras(cod);
  if (cod.length === 48) return boletoArrecadacaoLinhaDigitavel(codigo, validarBlocos);
  return false;
}




function identificarReferencia(codigo) {
    codigo = codigo.replace(/[^0-9]/g, '');

    const referencia = codigo.substr(2, 1);

    if (typeof codigo !== 'string') throw new TypeError('Insira uma string válida!');

    switch (referencia) {
        case '6':
            return {
                mod: 10,
                efetivo: true
            };
            break;
        case '7':
            return {
                mod: 10,
                efetivo: false
            };
            break;
        case '8':
            return {
                mod: 11,
                efetivo: true
            };
            break;
        case '9':
            return {
                mod: 11,
                efetivo: false
            };
            break;
        default:
            break;
    }
}


function identificarValorCodBarrasArrecadacao(codigo, tipoCodigo)  {
    codigo = codigo.replace(/[^0-9]/g, '');
    const isValorEfetivo = identificarReferencia(codigo).efetivo;

    let valorBoleto = '';
    let valorFinal;

    if (isValorEfetivo) {
        if (tipoCodigo == 'LINHA_DIGITAVEL') {
            valorBoleto = codigo.substr(4, 14);
            valorBoleto = codigo.split('');
            valorBoleto.splice(11, 1);
            valorBoleto = valorBoleto.join('');
            valorBoleto = valorBoleto.substr(4, 11);
        } else if (tipoCodigo == 'CODIGO_DE_BARRAS') {
            valorBoleto = codigo.substr(4, 11);
        }

        valorFinal = valorBoleto.substr(0, 9) + '.' + valorBoleto.substr(9, 2);

        let char = valorFinal.substr(1, 1);
        while (char === '0') {
            valorFinal = substringReplace(valorFinal, '', 0, 1);
            char = valorFinal.substr(1, 1);
        }

    } else {
        valorFinal = 0;
    }

    return valorFinal;
}

function substringReplace(str, repl, inicio, tamanho) {
    if (inicio < 0) {
        inicio = inicio + str.length;
    }

    tamanho = tamanho !== undefined ? tamanho : str.length;
    if (tamanho < 0) {
        tamanho = tamanho + str.length - inicio;
    }

    return [
        str.slice(0, inicio),
        repl.substr(0, tamanho),
        repl.slice(tamanho),
        str.slice(inicio + tamanho)
    ].join('');
}