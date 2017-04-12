
const contactFile = process.env.npm_package_config_contacts;
const port = process.env.npm_package_config_port;

let contacts = require(contactFile);

const program = require('commander');
const fs = require('fs');
const shortid = require('shortid');
const express = require('express');
const bodyParser = require('body-parser');
const clientHTTP = require('request');

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function displayContacts() {
  contacts.forEach(contact => console.log(`${contact.lastName.toUpperCase()} ${capitalizeFirstLetter(contact.firstName)}`));
}

program.option('--memory');
program.option('--http');
program.option('--promise');

program
    .command('list')
    .description('Command displaying the list of contacts')
    .action(displayContacts);


program
    .command('add <firstName> <lastName>')
    .description('Adding contact to the list of contacts')
    .action((firstName, lastName) => {
      const contact = { id: shortid.generate(), firstName, lastName };
      contacts.push(contact);
      if (program.memory) {
        fs.writeFile(contactFile, JSON.stringify(contacts), (err) => { if (err)console.log(err); });
      } else if (program.http) {
        const contactHTTP = { firstName, lastName };
        clientHTTP({
          method: 'POST',
          json: true,
          headers: {
            'content-type': 'application/json',
          },
          url: `http://localhost:${port}/contacts/`,
          body: contactHTTP,
        }, (error, response, body) => console.log(`body: ${body}`));
      }
    });

program
  .command('remove <id>')
  .description('Removing a contact from the list of contacts')
  .action((id) => {
    contacts = contacts.filter(c => c.id !== id);
    if (program.memory) {
      fs.writeFile(contactFile, JSON.stringify(contacts), (err) => { if (err)console.log(err); });
    } else if (program.http) {
      clientHTTP({
        method: 'DELETE',
        json: true,
        headers: {
          'content-type': 'application/json',
        },
        url: `http://localhost:${port}/contacts/${id}`,
      }, (error, response, body) => console.log(`body: ${body}`));
    }
  });

program
  .command('update <id> <firstName> <lastName>')
  .description('Update properties of a contact')
  .action((id, firstName, lastName) => {
    const index = contacts.findIndex(c => c.id === id);
    if (index !== -1) {
      contacts[index].firstName = firstName;
      contacts[index].lastName = lastName;

      if (program.memory) {
        fs.writeFile(contactFile, JSON.stringify(contacts), (err) => { if (err)console.log(err); });
      }
    }
  });

program
  .command('serve')
  .description('Start HTTP API')
  .action(() => {
    const app = express();

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: false }));

    // parse application/json
    app.use(bodyParser.json());

    app.get('/health', (request, response) => {
      response.sendStatus(200);
    });

    app.route('/contacts')
      .get((request, response) => {
        response.json(contacts);
      })
      .post((request, response) => {
        const id = shortid.generate();
        contacts.push(
          { id,
            firstName: request.body.firstName,
            lastName: request.body.lastName,
          });

        if (program.memory) {
          fs.writeFile(contactFile, JSON.stringify(contacts),
           (err) => { if (err)console.log(err); });
        }

        const location = `/contacts/${id}`;
        response.status(201).location(location).json(location);
      });

    app.route('/contacts/:id')
        .get((request, response) => {
          const contact = contacts.find(c => c.id === request.params.id);
          if (contact) {
            response.json(contact);
          } else {
            response.sendStatus(404);
          }
        })
        .delete((request, response) => {
          const prevLength = contacts.length;
          contacts = contacts.filter(contact => contact.id !== request.params.id);
          if (prevLength !== contacts.length) {
            if (program.memory) {
              fs.writeFile(contactFile, JSON.stringify(contacts),
              (err) => { if (err)console.log(err); });
            }
            response.sendStatus(204);
          } else {
            response.sendStatus(404);
          }
        });

    const server = app.listen(port, () => {
      console.log('port:', server.address().port);
    });
  });

if (!process.argv.slice(2).length) {
  program.help();
}

program.parse(process.argv);
